# Achados das revisões — `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-17 10:11:54 · `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A correção não cria nem altera nenhum caminho que grave `Nota`. Todos com autor humano? sim. Os caminhos que já existiam continuam iguais.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não tem saída de IA.
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim. A tarefa não altera nada disso.
Bloqueantes: nenhum
Recomendações: nenhuma da regra 70.

Esta tarefa só mexe na ferramenta de teste.

- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/workers-de-pe.ts`** (novo): lista os serviços em execução e para a integração com uma mensagem quando há despachante ou worker rodando. Não grava no banco, não chama IA e não lida com aluno, professor ou nota.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.ts`**: ganhou uma conferência antes da migration. A migration e o seed continuam iguais, então nenhum caminho de seed ou importação passa a gravar `Nota`.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/processo/sequencia-do-portao.ts`**: a única mudança é que `derrubarJob` passou a ser exportada.

A tarefa também não cria tela, prompt, campo, indicador de professor, nada que avalie discursiva ou redação, nem nada que acompanhe o comportamento do aluno. Não há fotos da tela no prompt, porque a tarefa não tem tela.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-17 10:11:56 · `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só em ferramenta de teste: a conferência dos serviços de pé no compose de teste e o `export` de `derrubarJob`. Não há migration, schema, repository, endpoint nem DTO.

Fora da tabela de dados do docs/lgpd.md: nada. Não entrou campo novo.

Autorização por objeto: não se aplica. Não há rota nem leitura de objeto de domínio.

Logs: limpos. O único texto novo é a mensagem de erro de `recusarJobDePe` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/workers-de-pe.ts`. Ela traz só nomes de serviço do compose (`despachante-1`, `worker-pdf`), o nome do projeto `educa-teste-N` e o comando `docker compose … stop …`. A saída do `ps` é capturada em memória, não vai para o log, e contém apenas nomes de serviço. A mensagem é de erro da ferramenta local de teste e nunca sai pela API.

Auditoria: não se aplica. Nenhuma das ações listadas na regra 20, item 10, foi tocada.

Envio externo: nenhum. O `spawnSync('docker', … 'ps' …)` roda localmente, sem rede e sem provedor de IA.

Seed/fixture: sintético. As fixtures de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/workers-de-pe.test.ts` e de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.test.ts` são só nomes de serviço do compose. A correção não toca o banco: o `migrate` continua o mesmo e, no teste, é falso.

Ciclo de vida: o comportamento ajuda a regra. A recusa nunca derruba nada sozinha, e isso tem teste (`ps` chamado uma vez, sem `stop` nem `down`). `EDUCA_BANCO_NOVO=1` continua com o mesmo `down --volumes` de antes e nada muda na retenção.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde envia. A resposta continua a mesma de antes desta tarefa.

Bloqueantes: nenhum.

Recomendações: nenhuma da minha regra.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-17 10:12:18 · `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/workers-de-pe.ts`, em `jobsDePe`: a saída do `ps` é quebrada só por `'\n'`, sem `trim` nas linhas. Se o Docker devolver `\r\n` ou espaço sobrando, um worker de pé passa sem aviso. Vale aplicar `.map((linha) => linha.trim())` e cobrir o caso com um teste.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.ts`, em `listarServicosDePe`: o `stderr` do `docker compose ps` é capturado e depois descartado. Quando o `ps` falha, a mensagem não diz o motivo (daemon fora, permissão). Vale incluir o `stderr` no erro de `recusarJobDePe`.

O que conferi:
- **A esteira não é afetada.** O job `integracao` sobe só a infra (`SERVICOS_INFRA`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/ci/compose.ts`), então nunca há worker de pé quando a conferência roda. No portão, a suíte `test` roda antes do e2e. O projeto `infra`, que vem depois do e2e com o ambiente completo de pé, fica de fora da recusa, como deve.
- **Nenhum teste de integração deixa worker de pé.** Os testes que mexem no compose, como `apps/despachante/test/outbox-sweeper.int.test.ts`, sobem workers dentro do próprio processo e dão `stop` nos do compose. A recusa não cria vermelho novo.
- **A recusa não derruba nada.** Os dois arquivos de teste provam isso, e os dois passam: 12 casos, rodados aqui.
- **O comando de parar não foi copiado.** A mensagem usa o mesmo `derrubarJob` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/processo/sequencia-do-portao.ts`.
- **A correção não toca código de produção.** Não muda carga, fila, IA, migration nem métrica.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-17 10:12:45 · `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. A correção faz o que o item "(F4, retro, M3)" do `TODO.md:2878` pede e nada além disso:
- O `globalSetup` recusa a integração quando há worker de pé.
- A mensagem traz o mesmo `stop` da sequência do portão, sem copiar o comando.
- Nada é derrubado sozinho.
- Há um caso de teste para cada lado: o projeto `integracao` recusa, o `infra` não.

**Aderência à Tech Spec:** ok. É correção de processo e não tem seção na Tech Spec. Também não há divergência registrada só no documento da tarefa.

**Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes:** nenhum.

O que conferi além do diff:
- **A esteira não quebra.** `ci:integracao` roda num runner limpo. O `test` do portão completo começa com `EDUCA_BANCO_NOVO=1`, e o `down --volumes` derruba os workers antes da conferência.
- **O portão continua igual.** O alvo de integração já roda o `derrubarJob` antes, e as mutações de integração também.
- **Nenhum teste de integração sobe worker sozinho.** Os `up` que existem sobem `redis-fila`, `postgres` e `borda`. A `borda` depende só de `api-1`, `api-2`, `realtime-1` e `realtime-2`, que ficam fora de `servicosDeJob`. Por isso nenhum arquivo deixa worker de pé para recusar a corrida seguinte.
- **A isenção do `infra` faz sentido.** Esse projeto vem depois do e2e com `--manter-ambiente`, e os testes dele convivem com os workers.

**Recomendações:**
1. `tools/processo/sequencia-do-portao.ts:35`: o comentário de `mutacaoDeIntegracao` diz que a integração "sobe só a infra e não olha quem já estava de pé". Depois desta correção isso deixou de ser verdade. Vale atualizar: o `stop` antes das mutações continua necessário, mas porque agora a integração recusaria, e não porque daria vermelho falso.
2. `tools/testes/integracao.setup.ts:15`: `listarServicosDePe` repete à mão o tipo `{ codigo: number; saida: string }`. Pode importar `ResultadoDoPs` de `tools/testes/workers-de-pe.ts`.
3. `tools/testes/workers-de-pe.test.ts`, caso "não derruba nada sozinha: só o `ps` é chamado": o caso só conta as chamadas do `ps`. Quem prova que nada é derrubado é o caso de `tools/testes/integracao.setup.test.ts` que procura `stop` e `down` nos comandos do Docker falso. Vale renomear um deles ou juntar os dois. A decisão é do `test-engineer`.
4. `TODO.md:2878`: o item segue `[ ]`. Precisa ser marcado no pouso por quem fecha a correção, se o fluxo não fizer isso sozinho.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-17 10:13:04 · `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: integração rodada à mão com worker de pé recusa, nomeia quem está de pé e dá o comando `stop`.
- O projeto `infra` convive com os workers e migra.
- Integração sem worker de pé sobe e migra.
- Projeto ausente no argumento recusa.
- `ps` que falhou não vale como "nada de pé": tanto o Docker ausente (status nulo, stdout nulo) quanto o processo morto por sinal (status nulo, stdout string).
- Serviço de nome parecido não conta.
- Nada é derrubado sozinho.
- Os testes passam nos três ambientes da regra 40: portão da tarefa, `npm run test` com `EDUCA_BANCO_NOVO=1` e esteira.
- Permissão e isolamento: não se aplicam (é ferramenta de teste, sem dado de escola). Concorrência: não se aplica.

Cobertos: recusa com nomes e `stop` (`workers-de-pe.test.ts` › recusa, nomeia…), nome parecido, só a infra de pé, nada de pé, `ps` com código 1, a fiação integração, infra e sem projeto, integração sem worker. Os dois arquivos passam (12 casos). Os 10 blocos de mutação cobrem as cláusulas novas do diff. Em `sequencia-do-portao.ts` só entrou um `export`, sem cláusula nova.

Bloqueantes:
1. **O teste fica vermelho no `npm run test` do portão, que roda com `EDUCA_BANCO_NOVO=1`.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.test.ts:24-32`.
   - O que está errado: o caso "na integração recusa com worker de pé, e não migra nem derruba nada" lê o `process.env` real. O `npm run test` inclui o projeto `unidade`, e o portão o roda com `EDUCA_BANCO_NOVO=1` (`sequencia-do-portao.ts:55`, `bancoNovo: suite === 'test'`). Nesse ambiente, `comandosDaSubidaDeTeste` põe o `down --volumes` antes do `up`, e a asserção da linha 31 (nenhum `stop` nem `down`) falha.
   - Prova: `EDUCA_BANCO_NOVO=1 npx vitest run --project unidade tools/testes/integracao.setup.test.ts` deu `expected true to be false` na linha 31. Isso quebra o `portao-local.ts --e2e --infra`, que vale no lugar da esteira.
   - Correção exigida: fixar o ambiente no teste, com `vi.stubEnv('EDUCA_BANCO_NOVO', '')` no `beforeEach` e `vi.unstubAllEnvs` depois. Ou então afirmar só que nenhum `stop` ou `down` acontece depois do `ps`. Com isso, vale acrescentar um caso com `EDUCA_BANCO_NOVO=1` que prove a ordem: o `down` vem antes do `ps`. Hoje nenhum teste prova o "depois da subida" do documento.

2. **O bloco `?? 1` fica vermelho pelo motivo errado.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.test.ts:48-56`, contra `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.ts:17`.
   - O que está errado: o caso usa `{ status: null, stdout: null }`, que é o Docker ausente. Com a mutação `?? 0`, o código chama `jobsDePe(null)`, cai num `TypeError` de `null.split` e continua falhando fechado, sem migrar. O vermelho vem só de a mensagem não bater.
   - O que fica sem prova: o caso em que a cláusula importa, que o próprio comentário da linha 16 cita ("o processo morreu por sinal"). Ali o `spawnSync` devolve `status: null` com `stdout` string, por exemplo `''`. Sem o `?? 1`, esse caso vira "nada de pé" e a integração segue calada.
   - Correção exigida: trocar o caso, ou acrescentar um, com `{ status: null, signal: 'SIGKILL', stdout: '' }`, afirmando a rejeição com 'Não foi possível listar' e `migrate` não chamado. Depois, apontar o bloco de mutação do `?? 0` para esse caso. Com a mutação, `subirInfra` resolveria e migraria, e o vermelho passa a ser pelo motivo certo.

Recomendações:
- O bloco `projeto.name` (sem `?.`) do documento também fica vermelho por `TypeError`, e o código mutado continua recusando. O teste "sem o projeto no argumento" pega a mutação que importa, mas o bloco devia declarar essa: `if (projeto !== undefined && projeto.name !== NOME_DO_PROJETO_DA_INFRA)`. Com ela, `subirInfra()` resolve e o caso fica vermelho pelo motivo certo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/workers-de-pe.test.ts:35-40` ("não derruba nada sozinha") não falharia por mutação nenhuma: `recusarJobDePe` não tem meio de derrubar nada. Quem prova a regra é o caso de `integracao.setup.test.ts` (depois da correção 1). Esse caso pode sair ou ser renomeado.
- O documento afirma que o Vitest 5 entrega `project.name` ao `globalSetup`, "conferido num projeto de brinquedo". Isso não tem teste no repositório. Se o Vitest mudar a assinatura, cai no lado que recusa, o que é seguro para a integração, mas o `infra` passaria a recusar depois do e2e. Vale registrar no `TODO.md` ou cobrir com um teste que leia a assinatura.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-17 10:29:34 · `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/workers-de-pe.ts:44`: se o `stderr` vier vazio, a mensagem de erro termina com uma quebra de linha sobrando. Basta acrescentar a linha do motivo só quando `resultado.erro.trim()` não estiver vazio. É detalhe de texto.

Nesta rodada conferi só o diff desde a 1ª. As duas recomendações dela entraram.
- **`trim` na saída do `ps`:** está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/workers-de-pe.ts:21`. O caso com `\r\n` e com espaço sobrando tem teste próprio, e há uma mutação declarada para ele.
- **`stderr` no erro do `ps` que falhou:** está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.ts:18`. O caso do Docker ausente (`stderr` nulo) tem teste e mutação.

Nada no diff chega ao código de produção. A mudança fica em ferramenta de teste e de processo (`tools/`), com comentário e `TODO.md`. Nenhum teste chama o Docker de verdade nem provedor pago.

Também saiu o caso "só o `ps` é chamado" de `workers-de-pe.test.ts`. A garantia que ele dava continua coberta em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.test.ts`: nada é derrubado depois do `ps`, e o `down` vem antes dele quando `EDUCA_BANCO_NOVO=1`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-17 10:29:41 · `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção do processo e não tem seção da Tech Spec. O documento da correção (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`) já descreve o que mudou nesta rodada: `trim`, `stderr`, o tipo `ResultadoDoPs` em um lugar só, o comentário de `mutacaoDeIntegracao` e a fixação de `EDUCA_BANCO_NOVO`.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

As quatro recomendações da minha 1ª rodada foram atendidas:
- **Comentário de `mutacaoDeIntegracao`:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/processo/sequencia-do-portao.ts:36`, agora explica por que o `stop` acontece antes das mutações.
- **`ResultadoDoPs`:** o setup importa o tipo em vez de redeclarar (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.ts:6` e `:14`).
- **Caso "não derruba nada sozinha":** saiu de `workers-de-pe.test.ts`. A prova passou para a fiação: nenhum `stop` ou `down` depois do `ps`, e o `down` vem antes do `ps` quando `EDUCA_BANCO_NOVO=1`.
- **`TODO.md`:** ganhou o item sobre a assinatura do `globalSetup`. O item "(F4, retro, M3)", na linha 2881, continua `[ ]`, e o documento registra que ele será marcado no pouso.

O diff também cobre as duas recomendações do `infra-guardian`:
- `jobsDePe` faz `trim` em cada linha.
- O erro do `ps` que falhou leva o `stderr`, com `?? ''` para o caso em que o `spawnSync` devolve nulo.

Fixar `EDUCA_BANCO_NOVO` com `vi.stubEnv` e desfazer em `afterEach` está correto, porque `comandosDaSubidaDeTeste` só derruba o banco quando o valor é exatamente `'1'`. Os dois casos (variável vazia e `'1'`) estão cobertos. As mutações novas morrem pelos testes declarados. Isso inclui a do `stderr` sem `?? ''`, que quebra no `.trim()` antes de chegar à mensagem esperada.

Recomendações:
- O caso "o Docker ausente" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tools/testes/integracao.setup.test.ts:83` simula um Docker que some entre o `up` e o `ps`. Na prática, sem Docker, o `up` falha antes, em `integracao.setup.ts:33`. Vale ajustar o nome do teste, ou o comentário em `integracao.setup.ts:17`, para não sugerir que esse é o caminho comum.
- No mesmo teste, `stdout: null` contradiz o tipo `saida: string` de `ResultadoDoPs`. Hoje não causa problema, porque o código diferente de 0 interrompe antes de `jobsDePe`. Se alguém mudar a ordem, o `split` quebra. Um `?? ''` em `saida`, como já foi feito em `erro`, deixaria o contrato coerente.

## test-engineer · 2ª rodada · APROVADO · 2026-11-17 10:29:47 · `tasks/correcoes/2026-11-17-integracao-recusa-workers-de-pe.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: a integração sem worker de pé sobe e migra.
- Recusa quando há worker de pé.
- O projeto `infra` convive com os workers.
- Sem o projeto no argumento, recusa.
- Serviço de nome parecido (`worker-pdf-extra`) não é confundido com o worker.
- Saída do `ps` com `\r\n` ou espaço sobrando.
- `ps` que falhou com código diferente de zero, e o erro diz por quê.
- `ps` morto por sinal (status nulo, saída vazia).
- Docker ausente (status, saída e erro nulos).
- Com `EDUCA_BANCO_NOVO=1`, o `down` vem antes do `ps`.
- Nada é derrubado depois do `ps`.

**Cobertos:** todos os cenários acima. As duas correções exigidas na 1ª rodada foram feitas.

1. **O teste dependia do ambiente.** O `tools/testes/integracao.setup.test.ts` agora fixa a variável no início de cada caso (`vi.stubEnv('EDUCA_BANCO_NOVO', '')` nas linhas 28 e 32) e desfaz depois.
   - O caso da recusa (linhas 35-44) passou a afirmar só que nada é derrubado depois do `ps`.
   - Entrou um caso com `EDUCA_BANCO_NOVO=1` (linhas 46-57) que prova que o `down` vem antes do `ps`.
   - Rodei o arquivo também com `EDUCA_BANCO_NOVO=1` no ambiente, como o portão faz: 7 de 7 verdes.
2. **O bloco `?? 1` ficava vermelho pelo motivo errado.** O caso de status nulo (linhas 73-81) agora usa `{ status: null, signal: 'SIGKILL', stdout: '' }`. Com a mutação `?? 0`, o `ps` vira "nada de pé", o setup segue e migra, e o `rejects.toThrow('Não foi possível listar')` fica vermelho pelo motivo certo. O bloco de mutação aponta para esse caso.

**Os blocos novos ou alterados** (12 no total, `--faltando: 0`):
- `stderr` sem o `?? ''` (caso "o Docker ausente"): o `.trim()` sobre nulo quebra dentro de `recusarJobDePe`, e a mensagem "Não foi possível listar" não aparece. A mutação está na linha que o caso exercita, então o vermelho vem do motivo certo.
- Sem o `trim` (caso "fim de linha do Windows"): `worker-pdf\r` e `  despachante-1  ` deixam de casar, e o `toEqual` fica vermelho.
- `projeto !== undefined && ...` (caso "sem o projeto no argumento"): sem argumento, o setup não recusa e migra, e o `rejects` fica vermelho.

O caso "não derruba nada sozinha", que nenhuma mutação derrubava, saiu de `workers-de-pe.test.ts`. O teste da assinatura do `project.name` foi para o `TODO.md` com dono. Os dois arquivos estão verdes (14 de 14). Não há `.skip` nem teste comentado, e o mock está só na fronteira (`spawnSync` e `migrate`). Não há IA nem concorrência a provar.

**Bloqueantes:** nenhum.

**Recomendações:**
- O `stderr` na mensagem do `ps` que falhou (`tools/testes/workers-de-pe.ts:44`) é provado pelo `toThrow('Cannot connect to the Docker daemon')` em `tools/testes/workers-de-pe.test.ts:310`, mas não tem bloco de mutação. Não é uma condição nova, então não bloqueia; um bloco que tire o `${resultado.erro.trim()}` deixaria isso registrado.
- O caso "com `EDUCA_BANCO_NOVO=1` o `down` vem antes do `ps`" (`tools/testes/integracao.setup.test.ts:46`) não tem bloco que inverta a ordem. Um bloco que mova a recusa para antes do laço da subida, em `tools/testes/integracao.setup.ts:31-37`, provaria que o caso pega essa troca.
- O caso "o Docker ausente" (`tools/testes/integracao.setup.test.ts:83-89`) poderia afirmar também que `migrate` não é chamado, como faz o caso do sinal.
