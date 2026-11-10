# Achados das revisões — `tasks/correcoes/2026-11-10-carga-professores.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-10 13:11:01 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: APROVADO
Caminho quente tocado: login (só documento e medição; nenhum código de `apps/`, `packages/`, `infra/` ou `e2e/` mudou)
Rate limit: ok (não mudou)
Fila e prioridade: ok (não mudou)
Concorrência: protegida (não mudou)
Índice e paginação: ok (não se aplica, sem query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há alerta novo; a seção nova do runbook diz quais leituras acompanham cada rodada: o hash antes e depois, e o `cpu.stat` das duas APIs)
Bloqueantes: nenhum

O que conferi:
- **O comando do runbook funciona.** Rodei os 20 hashes da raiz do repositório agora: mediana de 30,9 ms e p90 de 38,9 ms. Os parâmetros (`m=19456, t=12, p=1`, argon2id padrão) são os do `password-hasher.ts:51`, e a referência de ~30 ms bate com a Tech Spec da identidade (seção 5).
- **As premissas citadas existem no código.** As duas APIs com `cpus: 1` estão em `infra/compose.carga.yml:54-57`, e o projeto `educa-carga` está nos scripts. Os nomes `educa-carga-api-1-1` e `-2-1` seguem dessas duas coisas.
- **A correção cobre o caminho até APROVADA** (`validacao.md:94`): (a) duas rodadas calmas registradas no `10_task.md:70`; (b) a rajada sozinha separada da rajada junto com a fase `professores`; (c) a seção "Quando a carga vale como registro" no runbook, apontada pelo "Se reprovar".
- **A pendência da VPS não está duplicada.** O item do hash `t=12` na VPS é o único do tipo no `TODO.md`, tem dono e prazo (antes do piloto).

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/TODO.md:3368`: trocar "(item acima)" pelo nome do item do `LIMITE_REQ_IP_ANONIMO_MIN`. Ele está na linha 3337, e o item logo acima deste é outro (`escola.int.test.ts`).
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md` (seção nova, condição 2): o hash é medido no host antes e depois da rodada, não durante. Uma disputa que aparece só no meio da corrida passa pelas duas leituras e o vermelho acaba atribuído ao produto. A condição 1 (nenhum outro andar rodando) cobre isso só em parte. Vale dizer isso no texto, ou ler o hash e o `cpu.stat` também no meio da fase.
- Mesma seção: o critério é só a mediana. A medição de calma de agora deu p90 de 38,9 ms, então convém dizer se o p90 entra no critério ou fica só registrado.
- A que a própria correção já registrou, para o Arquiteto: os scripts `infra/scripts/carga-*.ts` medirem sozinhos o hash e o throttling e marcarem a rodada como "não vale" quando o hash passar de ~35 ms, para a condição deixar de depender de quem roda.

## test-engineer · 1ª rodada · APROVADO · 2026-11-10 13:11:05 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: APROVADO

Cenários exigidos: o crítico 1 da validação (`tasks/prd-acesso-e-convites/validacao.md:70`) pede três coisas.
- (a) A fase `professores` rodada com a máquina calma, mais de uma vez, com o resultado registrado.
- (b) A rajada medida sozinha, para separar os 503 que vêm da soma com a fase dos que vêm do host.
- (c) A condição de máquina em que a carga vale como registro, escrita no runbook, e um item no `TODO.md` para medir na VPS de produção (D82).

A correção não muda código. Por isso não há cláusula nova, e "Mutações: 0 linhas" está certo. Conferi no `git diff`: só mudaram `TODO.md`, `docs/runbook.md` e `10_task.md`, mais o documento da correção.

Cobertos:
- **(a)** As rodadas `prof1` e `prof2` passaram com zero 503, 90 de 90 redefinir, passo (3) 11 de 11 até 1 s e rajada p95 de 187 e 167 ms. O resultado está na tabela da correção (`tasks/correcoes/2026-11-10-carga-professores.md:44-45`) e na linha do [C] em `tasks/prd-acesso-e-convites/10_task.md:70`. Os números batem entre os dois documentos.
- **(b)** A rodada `rajada1` deu p95 102 ms e zero 503, contra 167 e 187 ms ao lado da fase. A conclusão é que os 503 não vêm da soma, e o documento não a estica além do que a medida mostra.
- **O vermelho reproduzido:** a rodada `estresse16`, com o hash a 68 ms, reprova com a mesma assinatura da validação (503 só em `/v1/sessao/matricula`, rajada a 1.415 ms). A `estresse6`, com o hash a 33,7 ms, passa. Isso separa a falha do host da falha do produto pela medida do hash, e não por palpite.
- **(c)** A seção nova "Quando a carga vale como registro" está em `docs/runbook.md` e o "Se reprovar" aponta para ela. O comando dos 20 hashes resolve `@node-rs/argon2` pela raiz (`node_modules/@node-rs/argon2` existe). Os parâmetros `m=19456, t=12` e os ~30 ms batem com `tasks/prd-identidade-e-tenancy/techspec.md:194`, e o `cpus: 1` das APIs com `infra/compose.carga.yml`. Os números do K2 citados (42 ms, 3.047 e 3.417 ms, 27%, 135 ms) batem com `tasks/correcoes/2026-11-10-k2-calmo.md`. O item da VPS entrou no `TODO.md`.
- **Nomes dos testes:** os quatro testes citados na linha do [C] existem com esses nomes, em `infra/test/carga-importacao.test.ts:241,355,387` e `infra/test/carga-login.test.ts:74`.
- **Limites ditos:** o documento diz com todas as letras que a causa da 1ª corrida da validação é hipótese, porque o hash não foi medido nela. Diz também que foram só duas rodadas calmas e que os laços de CPU não reproduzem o que estava de pé na validação.

Bloqueantes: nenhum.

Recomendações:
1. A condição do runbook continua dependendo de quem roda. O script não recusa sozinho uma rodada com o hash acima de ~35 ms. Pela regra, critério que só passa com a máquina folgada deveria ser provado ou guardado pelo próprio instrumento. A correção já levou isso ao Arquiteto (`tasks/correcoes/2026-11-10-carga-professores.md:67`), e o reforço aqui é que isso entre antes da revalidação da carga, ou pelo menos antes do piloto.
2. A frase "90 de 90 redefinir em 204" (`10_task.md:70`) fala do status 204, que a tabela da correção não mostra. Vale pôr o 204 na tabela, ou dizer que é o check do k6 que o conta.
3. O "27% a 28% no K2" do runbook vem da correção `k2-calmo`, que registra só 27%. Vale escrever de qual API é cada número, ou citar a origem.
4. A evidência bruta (o `cpu.stat` e a saída do k6) ficou fora do git, como o próprio documento registra. Na revalidação, vale guardar ao menos o resumo do k6 de uma rodada calma junto do registro.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-10 13:11:11 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção cumpre os itens (a), (b) e (c) do crítico 1 em `tasks/prd-acesso-e-convites/validacao.md:94`:
- (a) A fase rodou duas vezes com a máquina calma.
- (b) A rajada foi medida sozinha (`rajada1`) e também ao lado da fase.
- (c) A condição de máquina está escrita no runbook.

Nenhum arquivo de `apps/`, `packages/`, `infra/` ou `e2e/` foi tocado. A mudança nos scripts de carga ficou registrada como recomendação para o Arquiteto e não foi aplicada.

Aderência à Tech Spec: ok.
- Os parâmetros citados batem com `infra/carga.env:25-26` (`m=19456`, `t=12`) e com a calibração de ~30 ms da Tech Spec da identidade (seção 5, linhas 182-194).
- O `cpus: 1` das APIs bate com `infra/compose.carga.yml`.
- Os números do K2 citados no runbook (42 ms, 3.047 e 3.417 ms, 27% a 28%, folga de 135 ms) batem com `tasks/correcoes/2026-11-10-k2-calmo.md`.
- Nada diverge da Tech Spec.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

Recomendações:
1. `docs/runbook.md:1108`: o primeiro motivo do "Se reprovar" do `carga:login` diz que rajada acima de 1 s é falta de CPU e que "a saída é mais CPU por instância". Foi justamente esse critério que reprovou na validação. Falta ali o ponteiro para "Quando a carga vale como registro", como a correção já pôs no item do 503 da importação (linha 1198). Sem ele, quem ler só a seção do login pode mexer na infra quando o problema é o host.
2. `docs/runbook.md:1222`: "Acima disso" fica ambíguo, porque os tetos variam por cenário (5% a 6%, 10% a 11%, 27% a 28%). Vale escrever "acima da faixa do cenário".
3. `docs/runbook.md:1213-1215`: o comando dos 20 hashes mede no host, sem o teto de `cpus: 1` do container da API. Serve para saber se o host está disputado, mas não mede o hash dentro da API. Diga isso em uma linha, ou dê a variante com `docker exec` na API de carga.
4. `TODO.md:3368`: "(item acima)" aponta para a linha 3337, que está trinta linhas acima e tem outros itens no meio. Cite o item pelo nome, por exemplo "o item da 16.0 do `LIMITE_REQ_IP_ANONIMO_MIN`".
5. `tasks/prd-acesso-e-convites/10_task.md:70`: "90 de 90 redefinir em 204" pode ser lido como 204 ms. Escreva "com status 204".

Arquivos revisados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-carga-professores.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/TODO.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/10_task.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-10 13:17:34 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: APROVADO
Caminho quente tocado: login (só documentação e medição; nenhum arquivo de `apps/`, `packages/`, `infra/` ou `e2e/` mudou)
Rate limit: ok (não mudou; o ponteiro do `TODO.md` para a troca do `LIMITE_REQ_IP_ANONIMO_MIN` agora cita o item da 16.0, que existe em `TODO.md:3337`)
Fila e prioridade: ok (não mudou)
Concorrência: protegida (não mudou)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há métrica nem alerta novo)
Bloqueantes: nenhum

Das duas recomendações da 1ª rodada, as duas foram feitas em `docs/runbook.md` (hunk em torno da linha 1219):
- **Hash medido só antes e depois.** O texto agora diz que as duas leituras ficam nas pontas da rodada e que uma disputa no meio dela passa sem ser vista. Por isso um vermelho com o hash bom nas duas pontas se repete uma vez, com o `cpu.stat` lido a cada 5 s, e só o segundo vermelho conta como defeito do produto.
- **Papel do p90.** O texto diz que só a mediana entra no critério. O p90 e o máximo ficam só no registro, com os números de 10/11.

O resto do diff está coerente com a tabela da correção. O "Se reprovar" da importação aponta para "Quando a carga vale como registro". O throttling aparece por API e por rodada, com a origem de cada número. O "com status 204" entrou nos redefinir da tabela e na linha do [C] em `10_task.md`. O `git diff` contra `d5d472fe` não mostra diferença nos arquivos rastreados. O único arquivo que aparece é a correção, que ainda não está no git.

Recomendações:
- `docs/runbook.md` (o mesmo hunk): ler o `cpu.stat` a cada 5 s na repetição não mostra o custo do hash no meio da rodada, porque esta própria correção mostra que o throttling não separa a falha do host. A repetição poderia rodar também o laço dos 20 hashes ao mesmo tempo, ou medir o load a cada 5 s. Cabe junto da recomendação ao Arquiteto de os scripts de carga medirem e recusarem o registro sozinhos.
- `docs/runbook.md`: o 6% a 8% de throttling na rodada reprovada aparece tanto na correção quanto no runbook. Basta citar a correção no runbook para os dois textos não divergirem na próxima edição.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/TODO.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/10_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-carga-professores.md`

## test-engineer · 2ª rodada · APROVADO · 2026-11-10 13:17:41 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: APROVADO

Cenários exigidos: esta correção só mexe em documentação, sem cláusula nova de código, então nenhum cenário novo é exigido. Ficam valendo os da 1ª rodada, todos do [C] da 10.0:
- o redefinir dos professores sem nenhum 503;
- a fase `professores` rodando ao lado da rajada de login;
- a mesma fase sem a rajada ao lado, que precisa reprovar;
- a rajada levando a provisória e a conta só da escola;
- a execução manual com a máquina calma, repetida mais de uma vez;
- a execução com o host disputado.

Cobertos: todos. Nesta rodada conferi só o diff desde a 1ª (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/.processo/ordens/diff-carga-professores-r2.txt`). As duas recomendações que fiz na 1ª rodada foram aplicadas, e cada número novo bate com a fonte:
- **"90 de 90 com status 204":** a frase está nas quatro linhas da tabela de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-carga-professores.md` e na linha [C] de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/10_task.md:70`. O que diz o documento é o que o script exige: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/test/carga-importacao.test.ts:380` confere `contar(resposta, [204])` no teste "o redefinir dos professores…".
- **De onde vêm os 27% a 28% do K2:** `docs/runbook.md` agora traz o número por API (27,8% / 27,0%) e diz que ele vem de `tasks/correcoes/2026-11-10-k2-calmo.md`. Lá, nas linhas 37 e 38, estão 27,8% e 27,0%. Os outros números do throttling (rajada, `professores`) batem com a tabela da correção.
- **Item da 16.0 citado no `TODO.md`:** existe, na linha 3337, com o mesmo texto citado.
- **Texto novo do runbook:** está certo. O hash é medido no host, sem o teto de `cpus: 1`. Só a mediana entra no critério. A leitura é antes e depois, e vermelho com o hash bom nas duas pontas se repete uma vez com o `cpu.stat` amostrado. Não cria critério que precise de teste novo.
- **Mutações:** nenhuma cláusula nova de código no diff, então a seção "Mutações" com zero blocos está certa.

Bloqueantes: nenhum.

Recomendações:
- `docs/runbook.md`, no novo "vermelho com o hash bom nas duas pontas se repete uma vez": dizer também onde fica registrada essa primeira rodada vermelha descartada (na correção ou na validação), para que um verde na segunda tentativa não apague o primeiro vermelho.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-10 13:18:11 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: REPROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

**Correções da 1ª rodada:** as cinco recomendações foram aplicadas. A árvore de trabalho é a mesma de `d5d472f`.
1. O "Se reprovar" do `carga:login` agora aponta para "Quando a carga vale como registro" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md:1110-1111`).
2. O "Acima disso" virou "Acima da faixa do cenário", com o número de cada API e a origem. Os 27,8% e 27,0% batem com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-k2-calmo.md:37-38`.
3. O texto agora diz que o comando dos 20 hashes mede no host.
4. No `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/TODO.md:3368`, o "(item acima)" virou o nome do item. O item existe na linha 3337.
5. O status 204 agora aparece na tabela da correção e no `10_task.md`.

Bloqueantes:
- **O runbook diz duas coisas diferentes sobre o mesmo vermelho.**
  - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md:1222-1223` contra `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md:1229`.
  - O texto novo da condição 2 diz: "vermelho com o hash bom nas duas pontas se repete uma vez [...]; só o segundo vermelho é tratado como defeito do produto". Poucas linhas abaixo, na mesma seção, continua: "Vermelho com as três condições cumpridas é do produto: é defeito."
  - Um primeiro vermelho com a máquina calma, o hash bom antes e depois e o throttling lido cumpre as três condições. Pela linha 1229 ele é defeito; pela 1223 ele se repete. É essa seção que decide se a validação reprova ou não, então a regra fica sem leitura única.
  - O documento da correção também não registra essa regra nova de repetir uma vez. O resumo (c), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-carga-professores.md:55`, continua descrevendo só as três condições.
  - Correção exigida:
    - Reescrever a linha 1229 para bater com a regra nova. Por exemplo: "Vermelho com as três condições cumpridas, e repetido uma vez com o `cpu.stat` amostrado a cada 5 s, é do produto: é defeito." A outra saída é tirar a regra de repetir da condição 2.
    - Pôr no item (c) do documento da correção a regra de repetir o vermelho e a origem dela: a recomendação do `infra-guardian`, 1ª rodada, sobre a disputa que só aparece durante a rodada.

Recomendações:
- **Faixa do p90 sem registro.** Em `docs/runbook.md:1221-1222`, a faixa "p90 [...] de 30 a 44 ms, e o máximo de uma delas passou de 100 ms" não aparece em nenhum registro no git. A tabela da correção traz o p90 só da `estresse16`, e o `k2-calmo` traz 32,2 ms. Vale pôr o p90 e o máximo de cada rodada calma na tabela da correção, ou citar de onde vem a faixa.
- **Texto repetido no `10_task.md`.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/10_task.md:70`, "os 90 redefinir com status 204 (90 de 90)" diz o mesmo número duas vezes. Basta "90 de 90 redefinir com status 204", como está na tabela da correção.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-10 13:24:03 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum.

As duas correções da 2ª rodada foram feitas:
- **O runbook agora diz uma coisa só sobre o vermelho.** O parágrafo final da seção "Quando a carga vale como registro" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md:1229`) só chama de defeito o vermelho "com as três condições cumpridas **e repetido uma vez** (condição 2)". Isso bate com as linhas 1222-1223. O texto também diz que o primeiro vermelho não se apaga.
- **O item (c) do documento da correção traz a regra de repetir e a origem dela.** Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-carga-professores.md`, item (c). A origem citada é a recomendação do `infra-guardian` na 1ª rodada, com o motivo: a disputa que só aparece no meio da rodada passa pelas duas leituras do hash.

As duas recomendações da 2ª rodada também foram atendidas:
- **A faixa do p90 e do máximo agora está no git.** A correção ganhou a tabela "O hash em cada rodada", e o runbook aponta para ela. Conferi os números: nas três rodadas calmas o p90 vai de 30,2 a 44,2 ms, e o máximo passa de 100 ms uma vez só (109,3 ms, na `prof2`, depois). Isso bate com o "30 a 44 ms" e o "uma delas passou de 100 ms" do runbook.
- **A repetição saiu do `10_task.md`.** A frase agora é "90 de 90 redefinir com status 204", sem o "(90 de 90)" a mais.

Recomendações:
- `docs/runbook.md:1223` e `:1229`: o texto não diz o que vale quando a repetição dá verde. Hoje só se deduz que não é defeito. Vale escrever "verde na repetição: registra os dois resultados, e a rodada vale como verde com o primeiro vermelho anotado", para quem rodar não ter de interpretar.
- `docs/runbook.md:1229`: o trecho "o primeiro vermelho não se apaga" vem logo depois de "Vermelho (ou verde) fora das condições é medição". Lido assim, parece valer para a medição descartada, e não para o vermelho repetido da condição 2. Mover a frase para o fim da condição 2 deixa o texto sem ambiguidade.
- A citação da correção no "6% a 8%" do runbook continua pendente. Está registrada no `TODO.md` e na tabela de pendências da correção, então não precisa de mais nada nesta rodada.

## infra-guardian · 3ª rodada · APROVADO · 2026-11-10 13:24:08 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só documentação. O texto trata da medição de carga do login e da importação, sem mexer em código)
Rate limit: não se aplica (nada mudou nesta rodada)
Fila e prioridade: ok (nada mudou nesta rodada)
Concorrência: protegida (nada mudou nesta rodada)
Índice e paginação: ok (nada mudou nesta rodada)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhuma rota, métrica ou alerta novo)
Bloqueantes: nenhum
Recomendações:
- Os números conferem entre os três textos. Comparei a tabela nova "O hash em cada rodada" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-carga-professores.md` com a condição 2 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md:1219-1223`. Nas três rodadas calmas o p90 vai de 30,2 a 44,2 ms, e o único máximo acima de 100 ms é 109,3 ms, na `prof2`, depois da rodada. O "6% a 8%" da rodada com 16 laços bate com 6,3% / 8,3%. Continua aberto só o item de limpeza do `TODO.md` sobre citar a correção também nesse número. Ele já está registrado e não bloqueia.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md:1229`, a frase "Vermelho com as três condições cumpridas **e repetido uma vez**" dá para ler como "um vermelho seguido de uma repetição, qualquer que seja o resultado". Fica mais claro escrever "vermelho duas vezes seguidas, com as três condições cumpridas nas duas". A condição 2 já diz que só o segundo vermelho é defeito, então o sentido se mantém.
- A regra de repetir uma vez só aparece na condição 2 (hash bom nas duas pontas). Falta dizer se ela vale também quando o throttling da condição 3 passa da faixa do cenário num vermelho. Vale definir isso na próxima mexida no runbook de carga.
- A medição do hash `t=12` e das fases `professores` e rajada na VPS de produção (D82) continua pendente no `TODO.md`, com o Joaquim como dono. Precisa estar resolvida antes do piloto.

## test-engineer · 3ª rodada · APROVADO · 2026-11-10 13:24:12 · `tasks/correcoes/2026-11-10-carga-professores.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção muda só documentos, então não há cláusula de código nova. Nesta 3ª rodada conferi quatro coisas:
- a recomendação da 2ª rodada (onde fica escrito o primeiro vermelho descartado pela regra de repetir);
- se os números da nova tabela "O hash em cada rodada" batem com o runbook e com o `10_task.md`;
- se a regra "só o segundo vermelho é defeito" ficou igual nos dois documentos;
- se o "Se reprovar" do login e o da importação apontam para a seção "Quando a carga vale como registro".

**Cobertos:**
- **A recomendação da 2ª rodada foi feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md:1229` está escrito "o primeiro vermelho não se apaga: fica escrito junto do segundo resultado". O mesmo texto está em `tasks/correcoes/2026-11-10-carga-professores.md`, no item (c) e na linha "test-engineer (2ª)" da tabela. Um verde na segunda tentativa não apaga mais o primeiro vermelho.
- **Os números batem.**
  - O p90 das três rodadas calmas (`prof1`, `prof2`, `rajada1`) vai de 30,2 a 44,2 ms. O runbook diz "30 a 44 ms".
  - O máximo acima de 100 ms aparece uma vez só: 109,3 ms, em `prof2`, na leitura de depois. Isso confirma "por um hash isolado".
  - As medianas das rodadas calmas vão de 29,2 a 33,0 ms. O `10_task.md` diz "29 a 33 ms".
  - Os números de `estresse6` e `estresse16` são os mesmos da tabela principal da correção.
- **A regra ficou igual nos dois documentos.** O parágrafo final do runbook diz "três condições cumpridas e repetido uma vez (condição 2)", que é o que diz a condição 2. O item (c) da correção dá a origem da regra, uma recomendação do `infra-guardian` na 1ª rodada.
- **Os ponteiros existem:** `docs/runbook.md:1110-1111` no login e `docs/runbook.md:1199` na importação, como a correção afirma.
- No `10_task.md` a mudança é só de redação ("90 de 90 redefinir com status 204"). Os números não mudaram.

**Bloqueantes:** nenhum.

**Recomendações:**
- O ponteiro do login (`docs/runbook.md:1111`) só cobre o caso do hash acima de ~35 ms. Ele poderia dizer também que um vermelho com o hash bom antes e depois se repete uma vez. Hoje essa parte só está na seção para onde o ponteiro leva. Não bloqueia, porque o ponteiro manda para lá.
- O item novo do `TODO.md` (citar a correção ao lado do "6% a 8%" no runbook) está certo como pendência. Não mudei de avaliação.
