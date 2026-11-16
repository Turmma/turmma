# Achados das revisões — `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 09:54:21 · `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança fica só em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts`, e o arquivo não lê nem grava `Nota`. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente. A varredura só encerra `execucao_agente` órfã com `EXECUCAO_INTERROMPIDA`, que é um estado da fila. Ela não decide sobre a trajetória do aluno e não produz nada que chegue a ele.
Aprovação registrada: ok. Nenhuma saída de IA nova, nenhum fluxo de entrega ou artefato mexido. A exceção do tutor (D47) não foi estendida a nenhum outro agente.
Supervisão do tutor: ok. A tarefa não altera o tutor, o modo sala nem o registro e o resumo do modo casa.
Autonomia declarada e visível: sim. A tarefa não muda nenhum agente nem a governança.
Bloqueantes: nenhum.
Recomendações:
- `execucao-interrompida.int.test.ts:116` (`sobrasParaVarrer`) e o laço de `esvaziarAsSobras` encerram `pendente` e `rodando` de todas as escolas do banco compartilhado. Se o job de integração rodar arquivos em paralelo no mesmo banco, um `beforeEach` deste arquivo pode encerrar a execução viva de outro arquivo. Isso não é da regra 70, mas o `infra-guardian` e o `test-engineer` devem confirmar que a integração roda os arquivos em sequência.
- A correção copia o predicado do `encerrarPendentesSemJob` em SQL dentro do teste (linhas 108 a 119). Se o repository mudar, a cópia diverge sem aviso. Vale um comentário que aponte o repository como fonte da regra, ou um teste que compare os dois.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 09:54:25 · `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nem migration. `execucao_agente` e `job_registro` são usadas só como fixture do teste (o insert do caso novo leva `escola_id` e `ano_letivo_id` da escola B).
Queries verificadas: `sobrasParaVarrer` (`apps/api/src/ia/execucao-interrompida.int.test.ts:108`) é SQL de teste e não está em repository. O predicado dela é igual ao de `ExecucaoRepository.encerrarPendentesSemJob` (`apps/api/src/ia/execucao.repository.ts:181`), incluindo `j.escola_id = p.escola_id` na junção com o job. Nenhum código de produção mudou. Os únicos dois `@Unscoped` do repository (`encerrarRodandasVelhas` e `encerrarPendentesSemJob`) continuam com justificativa escrita e travados em `apps/api/src/ia/ia.int.test.ts:367-368`. A correção não abre endpoint, não aceita `escolaId` do cliente, não cria id fora de UUID e não toca a camada de rede.
Teste de isolamento: presente e efetivo. Não há módulo nem escopo novo, então a correção não precisava de teste de isolamento novo. O teste que já existe, `execucao-interrompida.int.test.ts:522` ("o job vivo de outra escola com o mesmo `execucaoId` não segura a `pendente`"), continua cobrindo a cláusula de escola da varredura, e o `esvaziarAsSobras` no `beforeEach` não o enfraquece: ele só encerra o que sobrou antes de cada caso e não muda o que o caso semeia nem o que ele confere.
Bloqueantes: nenhum
Recomendações:
- `apps/api/src/ia/execucao-interrompida.int.test.ts:108`: `sobrasParaVarrer` copia à mão o predicado do repository. Se um dia a junção por `escola_id` sair do `encerrarPendentesSemJob`, o auxiliar não mostra a diferença. Hoje quem pega essa regressão é o caso da linha 522. Vale um comentário no auxiliar dizendo que ele precisa seguir o predicado do repository e que a escola é conferida pelo caso da linha 522.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 09:54:28 · `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts`. Não há migration, repository, código de produção, DTO, rota nem log novo. O teste novo grava 1.050 linhas em `execucao_agente` só com o que a regra já permite: a `entrada` é `{"tarefa":"propor_ferramenta"}`, que é o formato anonimizado que o check `execucao_agente_entrada_da_tarefa` aceita. O `solicitada_por` é o professor sintético da escola `b`, criado pela fixture. Nenhuma linha tem nome, matrícula, conversa ou prompt.

Fora da tabela de dados do docs/lgpd.md: nenhum, porque não entra campo novo.

Autorização por objeto: ok, nenhuma rota foi tocada. A consulta `sobrasParaVarrer` e a `esvaziarAsSobras` percorrem todas as escolas, como a própria varredura, que é uma rotina administrativa nossa. Isso acontece só no banco de integração e não aparece em nenhum caminho de produção.

Logs: limpos. O diff não acrescenta nenhuma linha de log, e o caso novo não verifica nem produz log com conteúdo.

Auditoria: não se aplica. Nenhuma das ações que exigem auditoria (leitura de dado de aluno por coordenação ou rede, exportação, alteração de nota, alteração de permissão, aprovação de saída de IA) foi tocada.

Envio externo: nenhum. O bloco usa o adaptador falso, e o bloco do adaptador externo só ganhou o `beforeEach` de limpeza, sem envio novo.

Seed/fixture: sintético. As 1.050 linhas vão para a escola `b` da fixture, e o `limpar(a, b)` em `execucao-interrompida.int.test.ts:249-252` as apaga pelo `escola_id` no `afterAll` do bloco.

Bloqueantes: nenhum.

Recomendações:
- `esvaziarAsSobras` encerra `pendente` e `rodando` de qualquer escola no banco compartilhado. Hoje os arquivos de integração rodam um depois do outro, então isso não afeta os outros arquivos. Se um dia rodarem em paralelo, a limpeza pode encerrar no meio do caminho execuções que outro arquivo ainda está usando. Vale deixar isso escrito no comentário do auxiliar (`execucao-interrompida.int.test.ts:124-129`), para que a dependência do modo sequencial fique visível. Esse ponto é de isolamento entre testes, não de dado pessoal.
- `sobrasParaVarrer` (`execucao-interrompida.int.test.ts:108-120`) copia em SQL o predicado do `encerrarPendentesSemJob`. Se o predicado de produção mudar e a cópia não acompanhar, o `toBe(0)` falha ou deixa passar coisa errada. Seria melhor tirar o predicado de uma fonte compartilhada, ou deixar um comentário apontando para o arquivo de origem.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 09:54:56 · `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts:108-119`: `sobrasParaVarrer` repete à mão o predicado de `encerrarPendentesSemJob` e de `encerrarRodandasVelhas`, que estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao.repository.ts:166-196`. Hoje os dois batem: filas `interativa`, `ferramenta` e `normal`, tipo `ia.executar`, job ainda não finalizado na mesma escola e `rodando` acima de 300 s. O risco está numa mudança futura. Se o filtro da varredura for alterado e o teste não, o `expect(...).toBe(0)` passa a falhar sem a causa ficar clara, ou o laço gira sem necessidade. Convém deixar um comentário no repository apontando para esse auxiliar, ou guardar o predicado num lugar só que os dois usem.
- A causa da falha na esteira está anotada como "inferido", porque o log não traz quantas sobras havia. Vale fazer o `esvaziarAsSobras` registrar no log quantas voltas precisou. Assim a próxima corrida da esteira mostra se a sobra de fato passava de 1.000, sem depender de suposição.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/expurgo-da-escola.int.test.ts`: este arquivo e os outros que deixam milhares de `pendente` sem job no banco de integração compartilhado são a origem da sobra. A correção aqui só protege este arquivo contra ela. O ideal é que cada arquivo apague o que semeou, ou que o próximo teste que chamar a varredura vá para o TODO.

Notas da conferência:
- A mudança é só de teste. Os arquivos de integração rodam um por vez (`fileParallelism: false` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/vitest.config.ts`). Por isso o `beforeEach` que roda a varredura não corre ao mesmo tempo que outro arquivo.
- As 1.050 linhas que o caso novo semeia ficam na escola `b`, e o `limpar` do `afterAll` as apaga.
- No pior caso o hook dá 20 voltas, dentro do limite de 180 s.
- `tsc --noEmit` da API passou sem erro. Não rodei a suíte de integração, porque ela precisa do compose.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 09:55:27 · `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Recomendações:

1. **O SQL de `sobrasParaVarrer` repete o da produção sem nada que os amarre.** Está em `apps/api/src/ia/execucao-interrompida.int.test.ts:108-119` e copia à mão a condição do `encerrarPendentesSemJob` (`apps/api/src/ia/execucao.repository.ts:181-199`) e do `encerrarRodandasVelhas`.
   - Se a condição da produção ficar mais estreita, o laço gira 20 vezes e o `expect(...).toBe(0)` falha às claras, o que é aceitável.
   - Se ficar mais larga, a varredura passa a encerrar linhas que o auxiliar não conta. Ele dá 0 com sobra ainda no banco, e a instabilidade da esteira volta sem ninguém ver.
   - Vale um comentário apontando o método do repository de onde a condição saiu, ou uma constante comum aos dois lados.

2. **O caso novo (linha 469) leva no nome um auxiliar de teste (`esvaziarAsSobras`).** A metade que conta é a que já mostra a regra da Tech Spec §7c: a `pendente` além das 1.000 da volta fica para a volta seguinte. A outra metade prova o próprio auxiliar. Melhor um nome que descreva a regra do teto por volta da `pendente`, no mesmo molde do "a conta do laço" que já existe para a `rodando`.

3. **O documento da correção dá dois números para as sobras.** Na "Causa" diz "2.674 `falhou`" e, no parágrafo seguinte, "2.672 sobras". Precisa ficar um número só, ou a diferença precisa ser explicada.

4. **O caso novo e os que contam passos dependem de nenhuma outra varredura rodar ao mesmo tempo.** São eles:
   - o caso novo: `toBe('pendente')` depois de um `varrer()` e `toBe(1)` no fim;
   - "a volta para quando o lote não enche": conta exatamente 2 `update`.

   Na esteira não há risco: a integração não sobe o `worker-ia`, e os arquivos rodam um de cada vez (`vitest.config.ts:28`). Numa máquina onde o `worker-ia-1/2` do compose ficou de pé, a varredura dele, a cada 60 s, pode encerrar a linha entre o `varrer()` do teste e a conferência. O risco já existia antes desta correção. Se o processo voltar a aparecer, a saída é parar esses processos no `beforeAll` do primeiro bloco, como o bloco "Redis de fila fora" já faz.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-16 09:55:58 · `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

VEREDITO: REPROVADO

Cenários exigidos (correção só de teste, `apps/api/src/ia/execucao-interrompida.int.test.ts`):
- A sobra de outros arquivos (mais de uma volta de `pendente` sem job, mais velhas) deixa a `pendente` do caso de fora da volta. Isso reproduz o que a esteira viu.
- `esvaziarAsSobras` tira essas sobras antes do caso, e a `pendente` do caso é encerrada já na primeira volta.
- O `sobrasParaVarrer` usa o mesmo predicado do repository, para o auxiliar não parar com sobra de pé.
- Os três blocos que chamam a varredura começam sem sobra (`beforeEach`).
- A varredura quebrada, que devolve 0, não passa calada pelo auxiliar.
- Isolamento: o `encerrarPendentesSemJob` não muda. A varredura cruza escolas por desenho (`@Unscoped`), e o caso da escola (linha 522) segue como estava.

Cobertos:
- **Reprodução do que a esteira viu.** O caso novo (linha 469) semeia 1.050 `pendente` sem job de 400 dias. Depois de um `varrer()`, a `atrasada` segue `pendente` (linha 479) e a sobra é maior que zero (linha 480). Os números batem com o código: `LOTE_DA_VARREDURA` 200 × `PASSADAS_MAXIMAS` 5, e a ordem é `order by p.criada_em` em `execucao.repository.ts:195`.
- **Ação do auxiliar.** Depois do `esvaziarAsSobras`, a `atrasada` aparece `falhou`/`EXECUCAO_INTERROMPIDA`, e a `doCaso` é encerrada na volta seguinte.
- **Predicado.** O de `sobrasParaVarrer` (linhas 108 a 119) confere com o de `encerrarPendentesSemJob` (`execucao.repository.ts:184-196`) e com o de `encerrarRodandasVelhas` (`:167`): mesma escola, mesmas filas, mesmo tipo, `execucaoId` e estado não final.
- **Contagem pelo banco.** O auxiliar conta pelo banco, e não pelo retorno de `varrer()`. Isso cobre a varredura que falha e devolve 0, como prova o caso da linha 595.
- **Mutação.** A linha do bloco é a do diff, igual caractere por caractere. Com a mutação, o vermelho cai em `expect(await sobrasParaVarrer()).toBe(0)`, que é a cláusula nova, e o cenário chega a ela. Não há cláusula nova sem bloco.
- **Proibições.** Nenhum `.skip`, nenhum mock que esconda a regra e nenhum provedor pago: o adaptador é o falso, e no bloco externo a varredura grava só a linha estimada, sem chamar modelo.

Bloqueantes:

1. **A asserção nova da linha 485 depende do relógio** (`expect(await fila.varredura().varrer()).toBe(1)`).
   - **O problema:** `varrer()` devolve o total encerrado em todas as escolas, e as `rodando` entram nessa conta. Dois casos antes, em `a varredura de 60 s`, a linha 437 semeia a `quase` como `rodando` de 299 s. A linha 443 confere que ela fica, e nada a encerra depois. Ela passa a ser varrível 1 s depois de semeada.
   - **Quando falha:** se esse segundo vencer entre a última conferência do `esvaziarAsSobras` (linha 481) e o `varrer()` da linha 485, a volta encerra a `quase` junto com a `doCaso`, devolve 2 e o caso fica vermelho. A janela é curta, mas existe. Ela depende de quanto levaram o insert de 1.050 linhas e a primeira volta, isto é, da velocidade da máquina. É a mesma classe de falha que esta correção veio tirar: uma contagem global que depende do que outro caso deixou. O caso da linha 454 já evita isso com `toBeGreaterThanOrEqual(2)`. Também não é verdade o que o documento diz na seção "Causa": "Prova determinística no caso novo".
   - **Correção exigida:** não contar o total global. Uma das duas saídas:
     - trocar por `expect(await fila.varredura().varrer()).toBeGreaterThanOrEqual(1)` e deixar a prova com a linha 486, que confere o estado da `doCaso`;
     - ou contar só as execuções do caso, por id.

     Com isso, ajustar o "determinística" do documento.

Recomendações:
- **Mensagem na asserção do auxiliar.** O `expect(await sobrasParaVarrer()).toBe(0)` (linha 132) poderia trazer uma mensagem, por exemplo `expect(n, 'sobra de outros arquivos passou de VOLTAS_PARA_ESVAZIAR voltas').toBe(0)`. Quando outro arquivo deixar mais de 20 mil `pendente`, ou quando um passo cair no `statement_timeout` de 5 s com o `job_registro` grande, o vermelho no `beforeEach` precisa dizer de onde veio.
- **Fechar a `quase` no próprio caso.** O caso `a varredura de 60 s` poderia encerrar ou apagar a `quase` no fim. Assim nenhum caso seguinte do bloco herda uma `rodando` prestes a vencer. Isso vale além do bloqueante acima: o `beforeEach` novo depende hoje do relógio para tirá-la.
- **Os projetos `integracao` e `infra`.** Ambos usam `fileParallelism: false`, mas cada um vale só dentro do próprio projeto. Se os dois rodarem juntos, o `esvaziarAsSobras` pode encerrar a `pendente` que um arquivo de infra acabou de criar, antes de o job dela ser gravado. O risco já existia com o `varrer()` dos casos; ele cresce com até 20 voltas por caso. Vale registrar, se a esteira os junta.
- **Nome do caso.** O nome descreve a causa e o auxiliar ao mesmo tempo. Um nome que diga só a regra da varredura ("o que passa do teto da volta fica para a seguinte, da mais antiga para a mais nova") ficaria mais estável.

Não rodei o arquivo. Ele pausa e religa o `redis-fila` do compose, que os outros revisores usam ao mesmo tempo nesta árvore, e o portão da tarefa já provou a mutação.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/varredura-de-execucoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 10:04:22 · `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A ordem "da mais antiga para a mais nova" e o teto por volta seguem a §7c, "Laços e ritmo". Nenhum código de produção mudou.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Nesta rodada conferi o diff desde `ecf552c2` e o que ele afeta:
- **Comentários de `sobrasParaVarrer` e `esvaziarAsSobras`:** o primeiro diz de onde saiu a cópia do SQL e o segundo escreve a premissa de rodar um arquivo por vez. Essa premissa é verdadeira: `fileParallelism: false` está na linha 28 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/vitest.config.ts`.
- **Mensagem do `expect` final em `esvaziarAsSobras`:** agora ela diz a causa quando falha.
- **Nome do caso novo:** o documento usa o mesmo nome no "Teste que reproduz" e no bloco `mutacao`. A mutação continua mirando o laço do auxiliar, e o caso ainda passa por `esvaziarAsSobras` (linhas 486 e 487).
- **`toBe(1)` virou `toBeGreaterThanOrEqual(1)` (linha 492):** a asserção continua provando a regra, porque a linha seguinte confere o estado `falhou` com `EXECUCAO_INTERROMPIDA` da execução do caso.
- **Documento:** a "Causa" ficou sem a contagem local duplicada, e a explicação do número (2.674 = 2.672 + 2) está num parágrafo só, coerente.
- **Recomendações da 1ª rodada:** todas têm destino. Ou foram aplicadas, ou estão na tabela "Recomendações sem aplicar" com motivo, ou foram para o `TODO.md` (fonte única do predicado, limpeza dos arquivos que semeiam, os projetos `integracao` e `infra` juntos).

Recomendações:
- `apps/api/src/ia/execucao-interrompida.int.test.ts:492`: o retorno de `varrer()` virou um piso e já não diz nada sozinho. Ou se tira esse `expect`, ou se deixa explícito que ele só confere que a volta encerrou alguma coisa. Hoje o comentário acima dele já faz esse papel, então é só limpeza.
- A recomendação do revisor-geral sobre um `worker-ia` varrendo junto com o teste ficou "para quando voltar a aparecer" e não entrou no `TODO.md`. As outras recusas têm motivo próprio; essa fica sem registro rastreável fora do documento.

A tabela "Revisões" do documento ainda mostra o `test-engineer` REPROVADO na 1ª rodada. Esse veto é dele e o hook segura o commit; não entra no meu veredito.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/TODO.md`

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 10:04:35 · `tasks/correcoes/2026-11-16-varredura-da-pendente-na-esteira.md`

VEREDITO: APROVADO

**Cenários exigidos** (correção só de teste; nesta rodada audito só o diff e a correção que pedi na 1ª):
- Caminho feliz: a `pendente` sem job do caso é encerrada quando não sobrou nada antes dela.
- Borda 1: mais de uma volta de `pendente` sem job mais velhas, vindas de outro arquivo no banco compartilhado. A `pendente` do caso fica para a volta seguinte. Foi o que a esteira viu.
- Borda 2: uma `rodando` de outro caso vence o limiar de 300 s durante o caso.
- Borda 3: a varredura falha e devolve 0, e o laço parava com sobra de pé.
- Isolamento: a escola do job é a da execução (`j.escola_id = p.escola_id`). Quem prova é o caso existente `varredura, escola`.
- Permissão: não se aplica, porque não há rota nova.

**Cobertos:**
- A correção exigida foi feita. Na linha 492 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts`, a asserção agora é `toBeGreaterThanOrEqual(1)`. A prova passou para a linha 493, que confere o estado `falhou`/`EXECUCAO_INTERROMPIDA` da própria `doCaso`. O comentário diz por quê. A `quase` (linha 443), se vencer o limiar entre as duas linhas, só aumenta o total, e o caso deixa de ficar vermelho por isso.
- As outras asserções do caso não dependem do relógio:
  - linha 485: a `atrasada` segue `pendente` depois de um `varrer()`. As 1.050 de 400 dias vêm antes dela pela ordem de `criada_em`, e a `rodando` é outro tipo, que não mexe no teto das `pendente`.
  - linha 486: `sobrasParaVarrer() > 0`. Sobram pelo menos 50 das semeadas mais a `atrasada`.
- O documento corrigiu a seção "Causa". O "determinística" saiu e entrou "sem depender do relógio nem da ordem dos arquivos", com a explicação de que a prova é o estado de cada execução, e não o total. A contagem local (2.674) ficou consistente com o resto do texto.
- O caso foi renomeado e o novo nome aparece igual em três lugares: na seção "Teste que reproduz", no bloco `mutacao` e no `it` da linha 475. A mutação, que troca o `varrer()` do laço por `Promise.resolve()`, fica vermelha no `expect(...).toBe(0)` do `esvaziarAsSobras`. É a cláusula que importa, e o portão já provou essa mutação.
- A mensagem nova do `expect` no `esvaziarAsSobras` (linha 138) só torna o vermelho mais claro, sem mudar o que ele prova.
- Rodei `npx vitest run apps/api/src/ia/execucao-interrompida.int.test.ts` a partir da raiz: 29 de 29 passaram.
- Não há `.skip`, teste comentado nem chamada a provedor pago (o adaptador é falso).
- Os riscos que recomendei na 1ª rodada foram registrados no `TODO.md` ou recusados com motivo na tabela "Recomendações sem aplicar". Os dois que eu levantei estão lá: a `quase` (recusada, com motivo aceitável) e os projetos `integracao` e `infra` no mesmo banco (no `TODO.md`).

**Bloqueantes:** nenhum.

**Recomendações:**
- Fica para a retro: a premissa de que os arquivos de integração rodam um por vez (`fileParallelism: false`) agora está escrita no comentário do auxiliar (linhas 133 e 134), mas nenhum teste a guarda. Se a configuração mudar, nada fica vermelho antes de o `esvaziarAsSobras` encerrar a execução de outro arquivo. O item já está no `TODO.md`.
