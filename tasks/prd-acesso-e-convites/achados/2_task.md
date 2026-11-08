# Achados das revisões — `tasks/prd-acesso-e-convites/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-07 21:16:20 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nem migration nova. O limite `EMAIL_POR_MINUTO` fica só no Redis de fila (`email:minuto:<janela>:total|convite`). Ele é global por desenho e as chaves não guardam escola, convite nem dado pessoal. As métricas `email.envio{resultado}` e `email.adiado{motivo}`, o painel e o alerta não têm rótulo de escola.

Queries verificadas:
- `packages/core/src/queue/job-outbox.repository.ts:191-198`, `devolverAoPublicado`: o escopo vem de `jobScopeInContext()`, que lê a escola do contexto (`currentContext()`) e nunca de parâmetro. A busca também filtra `estado = 'ativo'`. A entrada em `REPOSITORIES_SEM_ESCOPO` (`tools/guardas/escopo-dos-repositories.ts:96` e `tools/guardas/repositories-com-escopo.test.ts:143`) tem o mesmo motivo já escrito para os irmãos `concluir` e `registrarFalha`.
- `apps/worker/src/job-executor.ts:443-451`, `adiar`: a vaga e o `jobId` vêm da linha gravada no banco, não do `data` do job.
- `apps/worker/src/processors/enviar-email.ts`: continua usando `envios.reservar(conviteId)` da 1.0, com a escola do contexto. Um convite de outra escola cai como `inexistente`, devolve o ponto e não envia. O log leva só ids.

A tarefa não tem endpoint novo, nada lê `escolaId` vindo do cliente e não há `@Unscoped()`.

Teste de isolamento: presente e efetivo. O teste está em `apps/worker/test/enviar-email-adiamento.int.test.ts:551-566`, em "`devolverAoPublicado` só alcança o job `ativo` da escola do contexto". Ele chama o método com o contexto da escola B sobre um job da escola A e espera receber `false`, com a linha ainda `ativo`. Se a cláusula `jobScopeInContext()` for removida, a chamada passa a devolver `true` e a linha vira `publicado`, então o teste quebra.

Bloqueantes: nenhum.

Recomendações:
- `apps/worker/test/enviar-email-adiamento.int.test.ts:309` e `312-323`: no caso "o convite que é de outra escola", o teste só confere que o ponto volta. Vale incluir `expect(enviadasPara(<endereço do convite da outra escola>)).toEqual([])`, para que o caso também prove por conta própria que nada foi enviado ao convite da outra escola. Hoje essa prova está só nos testes da 1.0.
- `apps/worker/src/job-executor.ts:446`: o retorno `false` de `devolverAoPublicado` é ignorado. Isso não vaza dado, mas um aviso no log (`job.adiado_sem_linha`, só com ids) mostraria uma linha fora de `ativo` em vez de passar em silêncio.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-07 21:16:28 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: APROVADO

A tarefa 2.0 não toca nenhum assunto da regra 70. Ela cuida do teto `EMAIL_POR_MINUTO`, do adiamento do job de e-mail no `JobExecutor`, das métricas `email.envio` e `email.adiado`, do alerta `email-falhou.yaml` e da entrada no runbook. Procurei no diff de código (`apps`, `packages`, `tools`, `infra`) por nota, correção, tutor, chamada a modelo de IA e métrica de professor e não achei nada. Os únicos resultados eram falsos positivos, como "não" e "pode" dentro de outras palavras.

Caminhos de escrita em Nota: nenhum criado ou alterado nesta tarefa. Todos com autor humano? Sim, porque nada no diff grava em `Nota`. A saída de adiar no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/src/job-executor.ts` é genérica, mas só reage ao `JobAdiadoError`, e só o `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/src/processors/enviar-email.ts` lança esse erro. Ela devolve o job à fila sem executar trabalho nenhum. Por isso não abre uma porta nova de escrita para nenhum outro job.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA nasce nesta tarefa. O e-mail de convite é um envio de sistema que a coordenação dispara, não um texto gerado por IA.
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim. Nenhum agente foi criado ou alterado, e a tarefa não tem tela.
Bloqueantes: nenhum
Recomendações:
- O texto de impacto no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md` diz que "o professor não recebe o convite". Ele está bem como descrição operacional. Se esse diagnóstico um dia virar lista ou painel com o nome do destinatário, vale lembrar o item 8 da regra 70: o painel e o alerta podem mostrar quantos convites falharam, mas não quais professores. Hoje as métricas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/telemetry/metrics.ts:169-177` não levam usuário, convite nem escola, o que está correto.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 21:16:52 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: APROVADO

A tarefa 2.0 não cria campo pessoal, rota nova nem destino novo de envio. O que ela acrescenta é um contador global no Redis, a saída de adiar no worker, duas métricas, um alerta e um parágrafo no runbook. Nada disso carrega dado de pessoa.

Campos pessoais tocados: nenhum novo. O endereço e o token cifrados do convite já existiam (tarefa 1.0) e estão em `docs/lgpd.md:77`. O job adiado não aumenta o tempo de guarda do endereço. Sem ponto no minuto, ele adia antes de reservar a linha, e ela fica `na_fila`. Com reserva de outro processo, a linha fica `enviando`. Nos dois casos a regra das 24 h continua valendo: a linha vira `falhou` e perde os cifrados pelo `retencao.expurgar-escola`.

Fora da tabela de dados do docs/lgpd.md: nada pessoal. As chaves do Redis são `email:minuto:<janela>:total` e `:convite`: contadores globais, sem escola, conta nem endereço (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/email/limite-por-minuto.ts`).

Autorização por objeto: ok.
- O método novo `devolverAoPublicado` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/queue/job-outbox.repository.ts:491-498`) filtra pela escola do contexto (`jobScopeInContext()`) e por `estado = 'ativo'`. Há um teste de isolamento para ele, o caso "devolverAoPublicado só alcança o job `ativo` da escola do contexto".
- Um convite de outra escola volta como `inexistente`. O job devolve o ponto e não envia. A métrica conta `ignorado` tanto para o convite de outra escola quanto para o id que não existe, então ela não revela se o registro existe.

Logs: limpos.
- `email.convite_adiado` grava só `conviteId`, `tentativa` e `tipo` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/src/processors/enviar-email.ts:347`).
- `job.adiado` grava só `jobId`, `tipo` e `esperaMs` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/src/job-executor.ts:217`).
- O erro do Redis é descartado sem ir para o log (`.catch(() => undefined)` e `.catch(() => false)`).
- A mensagem do `JobAdiadoError` é só o motivo, e nada do job vai para o Redis.
- Nas métricas, os rótulos são só `resultado` e `motivo`, sem escola nem convite. O teste das métricas confere quais rótulos existem.
- A consulta `psql` do runbook lista só ids, canal, estado e datas, e avisa que o endereço já foi apagado.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno pela coordenação ou pela rede, exportação, nota, permissão nem saída de IA.

Envio externo: nenhum destino novo. O e-mail do convite para o provedor de e-mail vem da 1.0 e já está mapeado em `docs/lgpd.md:78`. Esta tarefa só limita quantos saem por minuto e adia o que passa do teto. Nenhum dado de aluno é enviado.

Seed/fixture: sintético.
- O endereço de teste é `professora-<uuid>@convite.invalid`.
- O nome é "Professora sintética do adiamento" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/test/enviar-email-adiamento.int.test.ts:89-92`).
- No `.env.example` e no compose, só `EMAIL_POR_MINUTO=60`.

Pergunta de fechamento: a resposta não muda. O que o sistema guarda sobre o professor convidado e o envio dele ao provedor de e-mail continuam respondidos pelo que já existia. Esta tarefa não cria dado novo de titular nem destino novo de envio.

Bloqueantes: nenhum.

Recomendações:
1. Pôr no `docs/lgpd.md` uma linha curta sobre o contador global `EMAIL_POR_MINUTO`, ao lado dos "Contadores do acesso" (linha 89). Seria para deixar escrito que ele não leva pessoa nem escola, e que dura duas janelas de um minuto. Não é campo pessoal; a linha só antecipa a pergunta de quem lê o mapa de dados.
2. Nenhum teste confere que os eventos novos de log (`email.convite_adiado`, `job.adiado`) não levam o endereço. O código não leva, e a guarda `log-sem-dado-pessoal` cobre o padrão. Mesmo assim, um caso que conferisse que o texto do log não contém o endereço do convite ajudaria a prova da regra 20, item 9.
3. A consulta `psql` do runbook vê todas as escolas, o que é aceitável numa rotina nossa de operação, e só lista ids e datas. Uma frase lembrando que o `escola_id` não deve ir para mensagem fora do time completaria o texto. Os parágrafos vizinhos do runbook já fazem isso.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-07 21:17:22 · `tasks/prd-acesso-e-convites/2_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As quatro subtarefas foram feitas: o limite com a metade reservada ao link da conta, a saída de adiar, as métricas com o alerta e o runbook, e os testes. Nada da tarefa 3.0 (a cota de 300/h) nem do job da conta da 5.0 entrou. A classe `'conta'` do limite é pedida pela 2.1 e só é usada nos testes do limite.

**Aderência à Tech Spec:** ok. Encontrei as seis divergências da tabela do `2_task.md` na `techspec.md` §5 e no `cenarios.md` (RF11 e "Limites"):
- o nome e o padrão do `EMAIL_POR_MINUTO`
- a janela fixa e o arredondamento `N − ⌊N/2⌋`
- o uso contado ao fim da tentativa
- o `devolverAoPublicado` na lista `REPOSITORIES_SEM_ESCOPO`
- o ponto que volta também quando a cifra não decifra ou o banco falha
- o painel e a lista `REGRAS_PROVISIONADAS`

A do índice do `core` não muda a spec: o `email/index.ts` só aparecia na tabela de arquivos da própria tarefa.

**Portão local:** carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Alerta de adiamento longo:** a `techspec.md` §7c diz que o adiamento longo cai no "alerta de idade da fila". Esse alerta só existe para a fila `interativa` (`infra/grafana/alertas/job-interativo-esperando.yaml:45`, `fila="interativa"`), e o e-mail roda na `normal`. O runbook (`docs/runbook.md`, parágrafo "Adiamento não é falha") reconhece isso e manda olhar `job_espera_mais_antiga_s` à mão, mas ninguém reportou isso como premissa da spec que não se confirmou. Vale levar ao `infra-guardian` e registrar na §12 da spec ou no `TODO.md`.
2. **Consulta do runbook:** a consulta de "Primeiro olhar" em `docs/runbook.md` filtra `criado_em > now() - interval '1 hour'`. Um convite que virou `falhou` agora pode ter sido criado horas antes (até 24 h, com as retentativas), então a lista mostra menos do que o alerta conta. Filtrar pela hora do desfecho, ou alargar a janela, resolve.
3. **Contagem quando a cifra não decifra:** em `apps/worker/src/processors/enviar-email.ts:141-142`, o `concluir(..., 'falhou')` ignora o booleano e conta sempre `falhou`. Os outros desfechos usam `resultadoGravado` e contam `reserva_perdida` quando a linha não era mais deles. Usar a mesma função aqui deixa a métrica igual nos três caminhos.
4. **Ponto que não volta:** em `apps/worker/src/processors/enviar-email.ts:183-187`, se o `concluir` dentro de `montarMensagem` lançar erro do banco, o ponto não volta. A spec diz que o ponto volta quando "o banco falha", e isso só está feito na reserva. O efeito é pequeno (um ponto perdido até o fim do minuto), mas o código diverge do texto.
5. **Docblock do processador** (`enviar-email.ts:106-107`): a lista de quando o ponto volta não inclui "o banco falha na reserva", que o código faz (`reservarComPonto`) e a spec descreve.
6. **Subtarefas sem marcar:** as linhas 2.1 a 2.4 do `2_task.md` continuam `[ ]`. Na tarefa 1.0 elas já estavam `[x]` no próprio commit da entrega (`dcdf4423`).

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/src/processors/enviar-email.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/grafana/alertas/job-interativo-esperando.yaml`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/2_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/techspec.md`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 21:18:51 · `tasks/prd-acesso-e-convites/2_task.md`

```
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
1. Falta alerta para adiamento longo na fila normal. Em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/techspec.md:168 diz "adiamento longo: o alerta de idade da fila". Esse alerta só existe para a fila interativa (job-interativo-esperando.yaml), e o runbook admite isso (/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md:691-693). Se o EMAIL_POR_MINUTO ficar abaixo da demanda, o convite fica em `na_fila` sem nenhum alerta. Dá para criar um alerta de `job_espera_mais_antiga_s{fila="normal"}` só para e-mail, ou corrigir o texto da techspec.
2. O teto é global e não divide a vez entre escolas. Todo job adiado por `limite` acorda na virada do minuto, com no máximo 5 s de sorteio, e a escola com centenas de convites disputa por sorte com a escola que tem um. Assim a escola pequena pode esperar tanto quanto dura a fila da grande. A cota de 300/h da 3.0 alivia, mas não resolve: dez escolas no teto pedem 3000/h, e o convite só tem 1800/h (30/min). Vale conferir isso na 3.0 ou registrar no modelo de carga.
3. Quando o job adiado solta a vaga, o despachante publica o resto da fila de e-mail da escola. Esses jobs ficam atrasados no BullMQ e, a cada minuto, disputam a vaga `normal` da escola (quem perde tenta de novo a cada 1 s, pelo `esperarVaga`). Com dez escolas o custo é baixo. Vale registrar no modelo de carga (docs/infra.md, seção 3) antes de crescer.
4. O script Lua monta as chaves dentro do script, fora de `KEYS` (/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/email/limite-por-minuto.ts:44, script `SCRIPT`). Isso funciona em Redis de uma instância só, mas quebra em Redis gerenciado em modo cluster (migração da D26/D42). Na migração, passe as chaves por `KEYS` com hash tag.
5. O uso (`jobs`) agora é contado ao fim da tentativa (/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/src/job-executor.ts:333). A tentativa que morre com o processo não entra no uso da escola. A diferença é pequena; vale anotar na D14.
```

Rodei os testes da tarefa e passaram todos:
- integração: enviar-email-adiamento.int.test.ts e enviar-email.int.test.ts, 53 casos;
- unidade e guardas: job-executor, composition, email e as guardas alerta-tem-runbook e repositories-com-escopo, 146 casos;
- infra: alertas.test.ts e painel.test.ts, 21 casos.

O teste de concorrência existe: os dois workers disputando o teto e a reentrega presa na barreira, ambos `[P]`. O isolamento do `devolverAoPublicado` também tem teste. Nenhum teste chama provedor pago.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-07 21:19:21 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: REPROVADO

**Cenários exigidos**
- **Caminho feliz:** o envio sai quando a vaga do minuto abre.
- **Borda do domínio:**
  - o teto do minuto estoura e o job é adiado mais vezes que as tentativas;
  - o Redis de fila sai do ar e depois volta;
  - o ponto é gasto no segundo 59 e devolvido no minuto seguinte;
  - o ponto volta quando nada foi enviado: reserva de outro processo, envio já `enviado` ou `cancelado`, convite de outra escola, cifra que não decifra, banco que falha na reserva;
  - a tentativa recusada pelo SMTP (4xx ou 5xx) ou caída gasta o ponto;
  - metade do teto fica reservada ao link da conta;
  - a espera é o `msBeforeNext` mais o sorteio, e nunca 1 s fixo;
  - o uso (`jobs`) não conta a tentativa adiada.
- **Concorrência:** dois workers disputam o mesmo teto; o job roda duas vezes, com a reserva do outro presa na barreira.
- **Isolamento:** `devolverAoPublicado` com a escola do contexto; convite de outra escola.
- **Permissão:** não se aplica (é job de worker, sem rota).

**Cobertos**
- Cada linha da tabela "Testes que provam a regra" tem o seu caso, com o nome citado. Rodei os quatro arquivos e todos passaram:
  - `apps/worker/test/enviar-email-adiamento.int.test.ts`: 28 casos
  - `apps/worker/test/enviar-email.int.test.ts`: 25 casos
  - `apps/worker/src/job-executor.test.ts` e `packages/core/src/email/email-config.test.ts`: 61 casos juntos
- Os dois `[P]` são concorrência de verdade: o `Promise.all` de 60 consumos em duas conexões, e a barreira do `FakeEmailSender` com o segundo processador rodando no meio.
- O isolamento de `devolverAoPublicado` tem o job da escola B e o job que já não está `ativo`.
- Não há `.skip`, nem provedor pago, nem mock que esconda a regra. A liberação da vaga é provada pelo efeito: a lista de membros fica vazia e o job sintético roda na mesma passada.

**Bloqueantes**

1. **`packages/core/src/email/limite-por-minuto.ts:48-51`: o caminho de produção do relógio, o `TIME` do Redis, não tem teste nem bloco de mutação.**
   - Todo teste do limite injeta `relogio`. Os que não injetam (`enviar-email.int.test.ts:42` e `composition.test.ts:32`) usam teto de 100 000 ou nem consomem.
   - Trocar `if agora < 0 then` por `if false then` deixa a janela em -1 para sempre: em produção o teto nunca vira e, depois de 60 e-mails, nenhum convite sai mais. Trocar `tonumber(tempo[1]) * 1000` por `tonumber(tempo[1])` faz janelas de cerca de 16 h. As duas mutações passam verdes.
   - O `--faltando` não enxerga o Lua dentro da template string, e por isso disse "1 linha".
   - **Correção:** um caso sem `relogio`, com teto 1:
     - o primeiro consumo é concedido, e o `ponto.janela` dele é `floor(msDoRedis / 60000)`, com o `msDoRedis` lido de `redis.time()`;
     - o segundo consumo dá `sem_vaga`, com `msBeforeNext` igual a `60000 - msDoRedis % 60000`, com tolerância;
     - se o caso cair perto da borda do minuto, repetir ou aceitar a janela seguinte.
     Mais os dois blocos `mutacao` acima.

2. **`limite-por-minuto.ts:67` (`if classe == 'convite' then INCR chaveConvite`): cláusula nova sem bloco, e a mutação `if true then` sobrevive.**
   - Com ela, o link da conta também enche o contador do convite: dois links consumidos com N = 4 deixam o convite adiado, com o total ainda em 2.
   - Nenhum caso consome `conta` antes de `convite`. "metade do teto é reservada" e "o ponto do link da conta que volta" consomem o convite primeiro.
   - **Correção:** um caso com N = 4 que consome a conta duas vezes e depois o convite duas vezes, e exige os dois convites concedidos; mais o bloco.
   - Na mesma auditoria do Lua, as linhas abaixo precisam de bloco, ou de motivo escrito como o da linha 132:
     - as guardas `> 0` do `devolver` (linhas 82 e 85), que hoje só seriam alcançadas com o mesmo ponto devolvido duas vezes;
     - o `error_reply` da operação desconhecida (linha 91).

3. **`apps/worker/src/processors/enviar-email.ts:142` (`porResultado?.add(1, { resultado: 'falhou' })`, quando a cifra não decifra): nenhum teste falha se a linha for apagada.**
   - O caso "o resultado e o adiamento são lidos" não tem convite com cifra adulterada, e os casos da cifra não usam `MedidorDeTeste`.
   - É exatamente a série que o alerta `email-falhou.yaml` lê. A causa 3 do runbook (a `EMAIL_TOKEN_KEY` trocada) depende dela.
   - **Correção:** acrescentar ao caso de métricas um convite com `token_cifrado` adulterado, exigindo `falhou: 2`, e um bloco que tire a linha 142.

**Recomendações**
- **`enviar-email-adiamento.int.test.ts:256`:** o `new Set(esperas).size > 1` é decorativo. `ate - antes` já varia com o tempo de execução e passaria mesmo com sorteio fixo. Quem prova o sorteio é o `[U]`. Tirar a linha, ou ler o `esperaMs` do log `job.adiado`.
- **`enviar-email-adiamento.int.test.ts:406-408`:** o caso compara o `now()` do Postgres com o relógio do processo (`systemClock`), e no limite de cima a folga é só o tempo decorrido. Injetar um `RelogioMovel` a partir do `reservadoEm` lido da linha, como já faz o `[P]` da barreira.
- **`enviar-email-adiamento.int.test.ts:309`:** no caso do convite de outra escola, exigir também que nada foi enviado ao endereço dele e que a linha não mudou, e não só que o envio seguinte saiu.
- **`apps/worker/src/job-executor.ts:315`:** o `renovacao.parar()` do ramo adiado não tem prova. O `renovar` do `concurrency-slot.lua` faz `ZADD` sem condição, então uma renovação que dispare entre o `liberarVaga` e o `finally` devolve a vaga ao job adiado. Um caso com relógio falso que avance o intervalo de renovação durante o adiar fecharia isso.
- **"cai com ler-e-gravar" (linha 55 da tabela):** está declarado, mas nenhum bloco o prova. Vale registrar como motivo, ou trocar o script por GET e depois INCR num bloco.

Documento auditado: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/2_task.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 21:40:02 · `tasks/prd-acesso-e-convites/2_task.md`

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
- A recomendação da rodada 1 sobre o runbook foi atendida. O "Primeiro olhar" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md` (linhas 677-681) agora olha as últimas 25 h, porque o convite não guarda a hora em que virou `falhou`. Também ganhou a frase que mantém o `escola_id` só dentro do time.
- Esta rodada só mudou testes, um comentário, o runbook e o arquivo da tarefa. A devolução do ponto quando o banco falha na reserva (`apps/worker/src/processors/enviar-email.ts:163-166`) e o `renovacao.parar()` antes de `adiar` (`apps/worker/src/job-executor.ts:314-316`) já estavam no código aprovado. Agora há testes que os provam: `apps/worker/src/job-executor.test.ts` cobre a renovação em andamento antes de liberar a vaga, e `apps/worker/test/enviar-email-adiamento.int.test.ts` cobre a devolução dupla do ponto e o relógio do Redis.
- `apps/worker/test/enviar-email-adiamento.int.test.ts`, no caso "o limite com o relógio do Redis": perto da virada do minuto, o teste espera até cerca de 10 s pela própria conta. Cabe no `testTimeout` de 60 s, mas alonga a esteira. Dá para deixar como está. Se pesar no portão, troque por um prefixo dedicado e uma conferência que aceite as duas janelas.
- Continuam valendo as recomendações de infra da rodada 1 já registradas na tarefa: o teto global sem divisão entre escolas, as chaves do script Lua fora de `KEYS` e o alerta de idade da fila `normal`.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-07 21:40:16 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:** nenhuma tabela nova e nenhuma migration neste diff. A tabela `convite` é a mesma da 1ª rodada, com `escolaId` e id UUID. O contador `EMAIL_POR_MINUTO` no Redis é global por desenho. Ele não guarda dado de escola nem de pessoa, e os casos novos (o link da conta, o ponto devolvido duas vezes e o `TIME` do Redis) não mudam isso.

**Queries verificadas:**
- A reserva e o `concluir` do `enviar-email.ts` rodam dentro de `runInContext` com o `escolaId` do job. O código não mudou desde a 1ª rodada: neste arquivo o diff só altera o comentário.
- `devolverAoPublicado` não mudou e segue escopado pela escola do contexto.
- A consulta nova do `docs/runbook.md:674-681` é uma rotina operacional nossa, sem escopo de escola. Ela lê só id, `escola_id`, canal, estado e datas, sem endereço nem token. O texto agora diz que o `escola_id` não sai do time.
- Nenhum endpoint novo e nenhum `@Unscoped()` novo.

**Teste de isolamento:** presente e efetivo. A correção pedida na 1ª rodada foi feita, em `apps/worker/test/enviar-email-adiamento.int.test.ts:309-327`. No caso "o convite que é de outra escola", o job roda no contexto da escola A com um convite da escola B. O teste agora confere duas coisas:
- nada foi enviado ao endereço do convite (`enviadasPara(semEnvio.endereco)` vazio);
- a linha do banco ficou idêntica à de antes.

Se eu tirar a cláusula de escola da reserva, a linha vira `enviando` ou `enviado` e o e-mail sai para o endereço de B, e as duas asserções quebram. Os arquivos ainda não rastreados (`enviar-email-adiamento.int.test.ts`, `limite-por-minuto.ts`, `job-adiado.error.ts`, `email-falhou.yaml`) são iguais aos do commit `4bd2806` auditado.

**Bloqueantes:** nenhum.

**Recomendações:**
- `apps/worker/test/enviar-email-adiamento.int.test.ts:57-62`: a asserção nova de log só confere que o endereço não aparece. O comentário dela também promete que o token do convite não aparece. Dá para incluir o token, decifrado de `semEnvio`, na mesma checagem.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-07 21:40:19 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A rodada mexe no adiamento do e-mail de convite, no limite `EMAIL_POR_MINUTO`, nos testes, no `docs/runbook.md` e na própria tarefa. Nenhuma dessas mudanças grava, lê ou deriva `Nota`. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA entra neste diff, e a exceção do tutor (D47) não aparece em outro lugar.
Supervisão do tutor: ok. O tutor não é tocado.
Autonomia declarada e visível: sim. Nenhum agente foi criado ou alterado, então nada mudou na declaração.
Bloqueantes: nenhum

Conferi o diff entre `9a8a8524` e `4bd28061`, gravado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-2_task-r2.txt`. A rodada 1 não exigiu correções, então não havia nada a cobrar.

O que muda e o que isso tem a ver com a regra 70:
- **`apps/worker/src/processors/enviar-email.ts`**: no diff, só o comentário muda. Ele passa a dizer que o ponto volta quando "o banco que falha na reserva". O teste novo de métrica conta `falhou: 2`, porque agora também cobre a cifra que não decifra. Nada disso toca nota, aluno ou IA.
- **`apps/worker/test/enviar-email-adiamento.int.test.ts`**: o teste novo confere que os eventos `job.adiado` e `email.convite_adiado` não levam o endereço do convite. Isso reforça a regra 20, item 9. As métricas continuam sem professor, usuário ou convite, então não se forma indicador de professor (regra 70, itens 8 e 9).
- **`docs/runbook.md`**: a consulta de convites `falhou` mostra só ids e datas, e o texto diz que o `escola_id` não sai da equipe. Não há lista nominal nem ranking de quem recebeu ou deixou de receber convite, então o item 8 da regra 70 fica preservado.
- **`apps/worker/src/job-executor.test.ts`** e **`tasks/prd-acesso-e-convites/2_task.md`**: são a ordem entre a renovação e a liberação da vaga, os blocos de mutação novos e as recomendações registradas. Nenhum dos dois toca nota, aluno, IA ou professor.

Recomendações:
- Mantenho a da rodada 1, já registrada na tarefa: se um dia a falha de convite virar lista ou painel com o nome do destinatário, essa tela precisa ser revista contra o item 8 da regra 70.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-07 21:40:19 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Li só o diff `9a8a8524..4bd28061` e o que ele afeta. As duas recomendações da 1ª rodada que eram da minha regra foram feitas.

1. **Teste do log do adiamento:** `apps/worker/test/enviar-email-adiamento.int.test.ts:199-204` agora confere a quantidade de eventos `job.adiado` e `email.convite_adiado` e verifica que nenhuma linha de log do job ou do convite contém o endereço. Conferi que a captura alcança os dois lados: o executor (`executorCom`, linha 160) e o processador (linha 188) gravam no mesmo `InMemoryLog`, de modo que o `job.adiado` do executor também é verificado.
2. **`escola_id` no runbook:** `docs/runbook.md:677-681` diz agora que o `escola_id` da consulta é só para o time e não vai para mensagem fora dele. A consulta continua trazendo só ids, `canal`, `envio` e datas, sem endereço. A janela de 25 h está explicada e não traz dado novo.

O resto do diff não muda nada da regra 20:
- **Executor:** um caso novo para a ordem entre renovação e liberação da vaga, em `apps/worker/src/job-executor.test.ts`.
- **Processador:** em `apps/worker/src/processors/enviar-email.ts:107` mudou só um comentário.
- **Limitador e métrica:** casos novos do limitador (relógio do Redis, classe `conta`, ponto devolvido duas vezes) e o caso da cifra adulterada contando `falhou`. A métrica continua só com os rótulos `resultado` e `motivo`.
- **Arquivo da tarefa:** mutações novas no `2_task.md`.

Campos pessoais tocados: nenhum novo. O endereço do convite continua cifrado e é apagado no desfecho, como foi aprovado na 1ª rodada.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. O diff não traz rota nova. Continua o caso em que o convite de outra escola não envia nem muda a linha (`enviar-email-adiamento.int.test.ts:310-326`), e ele agora também confere que a linha ficou como estava.
Logs: limpos. Isso agora está provado por teste no adiamento.
Auditoria: não se aplica. A tarefa não faz leitura de dado de aluno pela coordenação ou pela rede, nem exportação, nota, permissão ou saída de IA.
Envio externo: o e-mail do convite vai ao servidor SMTP configurado e nada mais. Não há envio a provedor de IA, então não cabe registro em `ExecucaoAgente`.
Seed/fixture: sintético (`professora-<uuid>@convite.invalid`; o token cifrado do caso adulterado é `Buffer.alloc(40, 7)`).
Bloqueantes: nenhum.
Recomendações:
- `apps/worker/test/enviar-email-adiamento.int.test.ts:199`: o comentário diz "nunca o endereço nem o token", mas a verificação só cobre o endereço. Ou o teto do minuto passa a ser estourado depois da decifração e se confere que o link ou token montado não aparece no log, ou o comentário passa a falar só do endereço.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/test/enviar-email-adiamento.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 21:40:33 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada, só as três correções e o que elas afetam):
1. O relógio de produção do limite, o `TIME` do Redis, com bloco para o `if agora < 0` e para a conta em ms.
2. O link da conta não enche o contador do convite, com bloco. As guardas `> 0` do `devolver` precisam de bloco, e o `error_reply` de bloco ou motivo.
3. A cifra que não decifra conta `falhou` na métrica que o alerta lê, com bloco.

Cobertos:
1. **Feita.** O caso `apps/worker/test/enviar-email-adiamento.int.test.ts › o limite com o relógio do Redis (o de produção) › sem relógio injetado…` cria o limite sem `relogio`, com teto 1.
   - Ele exige a `janela` do primeiro consumo entre `floor(antes/60000)` e `floor(entre/60000)`, lidos de `redis.time()`.
   - O `msBeforeNext` do segundo tem de ficar entre `60000 - depois%60000` e `60000 - entre%60000`.
   - Perto da virada do minuto, ele espera a janela seguinte (sobram menos de 10 s, e o teste tem prazo de 60 s).
   - `if false then` deixa a janela em -1, e tirar o `* 1000` deixa a janela perto de 29 833 em vez de perto de 29,8 milhões. As duas mutações quebram a primeira asserção, e as duas têm bloco.
2. **Feita.** O caso `› o link da conta não enche o contador do convite` usa N = 4 e consome conta, conta, convite, convite, com os quatro concedidos.
   - Com `if true then`, o terceiro consumo daria `sem_vaga`.
   - O caso `› o mesmo ponto devolvido duas vezes…` derruba as duas mutações `>= 0`. Sem a guarda do total, viriam 2 convites e 3 contas. Sem a guarda do convite, viriam 3 convites e 1 conta. O teste exige 2 e 2.
   - As três mutações têm bloco. O `error_reply` ficou sem bloco, com motivo escrito no `2_task.md`: as duas operações são fixas na classe. O motivo é aceitável.
3. **Feita.** O caso de métricas agora tem um convite com `token_cifrado` adulterado (`Buffer.alloc(40, 7)`) e exige `falhou: 2`.
   - O bloco tira a `enviar-email.ts:142`, com contexto que bate com o código atual.

Conferi também as recomendações aplicadas nesse diff:
- O teste novo do `job-executor`, com a renovação pendente, prova que `liberar` só vem depois de `renovou`. O bloco tira a `job-executor.ts:315`, e o contexto bate.
- O log do adiamento leva só ids, sem o endereço. A asserção cobre todas as linhas do log que citam o job ou o convite.
- No `SEM_ENVIO`, o caso exige agora que nada saia para o endereço e que a linha fique como estava.
- O `baseMs: 20_000` do prazo da reserva agora é exato: o relógio do processo parte do `reservadoEm` gravado pelo banco.
- A asserção dos sorteios diferentes saiu do teste de integração. Ela continua no teste de unidade (`job-executor.test.ts › dois sorteios diferentes`), que tem bloco próprio.
- Fora dos arquivos sem rastreio no git, a árvore de trabalho é igual ao commit `4bd28061`.

Rodei `npx vitest run apps/worker/test/enviar-email-adiamento.int.test.ts apps/worker/src/job-executor.test.ts`: 2 arquivos e 78 testes, todos verdes.

Bloqueantes: nenhum.

Recomendações:
- O caso do relógio do Redis confere a janela e o `msBeforeNext` por faixa, e não pela igualdade exata que a correção pediu. Ele já derruba as duas mutações, e não precisa de mais nada. Se a faixa for apertada um dia, dá para ler o `TIME` dentro de um `MULTI` junto do consumo, mas isso só melhora o teste.
- Esse caso pode dormir até cerca de 10,2 s de verdade quando cai perto da virada do minuto. Ele cabe no prazo de 60 s, mas pesa no tempo do portão em cerca de 1 rodada a cada 6. Para evitar a espera, basta aceitar a janela seguinte nas asserções.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 21:40:43 · `tasks/prd-acesso-e-convites/2_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` diz que vale para o código atual: typecheck, lint, segredo, dependências, unidade e alvo. Depois do diff da rodada 2, nenhum arquivo rastreado mudou.

Bloqueantes: nenhum.

Recomendações:
- **As sete linhas prometidas no `TODO.md` não existem ainda.** A tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/2_task.md` manda sete itens para o `TODO.md`:
  - `job.adiado_sem_linha`;
  - a linha no `lgpd.md` sobre o contador `EMAIL_POR_MINUTO`;
  - o alerta de idade da fila `normal` (§7c);
  - o `resultadoGravado` da cifra;
  - o ponto que se perde quando o `concluir` de `montarMensagem` falha;
  - as chaves fora de `KEYS` em Redis cluster;
  - o uso (`jobs`) contado só ao fim da tentativa, nota para a D14.

  O `TODO.md` não foi alterado e nenhuma dessas linhas está lá. O `task-template.md` exige "a linha já escrita no `TODO.md`, no commit da tarefa, e não promessa". Como o commit ainda não aconteceu, isto não bloqueia agora. Mas as sete linhas precisam entrar antes do commit, e escrever no `TODO.md` não derruba o carimbo (`caducidade.ts:249`).
- **O caso com o relógio do Redis espera o relógio de verdade.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/worker/test/enviar-email-adiamento.int.test.ts`, no bloco novo "o limite com o relógio do Redis", o caso espera até 10 s quando cai perto da virada do minuto. Dá para aceitar, mas pode passar de metade do prazo numa máquina carregada. Se isso aparecer na esteira, há duas saídas:
  - aumentar o prazo do caso;
  - aceitar que os dois consumos caiam em janelas diferentes, conferindo cada um com o `TIME` lido em volta.
- **A garantia de que o jitter varia saiu do teste de integração.** A troca na tabela de cenários do `2_task.md` ("cai com ler-e-gravar" passou a dizer que o caso prova o resultado, e não a atomicidade) está honesta e bate com o `cenarios.md:46`. Já a asserção `new Set(esperas).size > 1` foi retirada desse teste, e isso fica coberto só pela unidade em `job-executor.test.ts` (o caso "sorteadas.size > 1"). Basta registrar isso no documento, para ninguém procurar a prova no teste de integração.

O que conferi neste diff:
- **Docblock do processador:** "o banco que falha na reserva" bate com `reservarComPonto`, que devolve o ponto e repassa o erro (`enviar-email.ts`, por volta da linha 165).
- **Ordem do adiamento no executor:** em `job-executor.ts:314-316`, `renovacao.parar()` roda antes de `adiar`, e o caso novo do executor prova essa ordem.
- **Runbook:** a janela de 25 h do "Primeiro olhar" vem explicada, e o `escola_id` fica só com o time.
- **Recomendações da rodada 1:** as três foram aplicadas (runbook, docblock e subtarefas 2.1 a 2.4 marcadas).
