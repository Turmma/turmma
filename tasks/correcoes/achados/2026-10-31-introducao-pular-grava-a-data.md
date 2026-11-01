# Achados das revisões — `tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 20:25:37 · `tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

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
- `e2e/coordenacao-introducao.spec.ts:112` e `e2e/professor-introducao.spec.ts:117`: o atraso de 1 s em `page.route('**/v1/eu/introducao')` continua valendo depois do `page.goto('/')`. Hoje não tem efeito, porque a entrada seguinte não grava de novo. Se um dia ela passar a ler ou gravar nesse endereço, o caso fica 1 s mais lento sem motivo. Sugestão: chamar `page.unroute('**/v1/eu/introducao')` logo depois do `expect.poll` que espera a data no banco.
- O ponto 8 (relógio no servidor, gravação de uma vez só, retomada) está provado pela gravação existente: `coalesce(introducao_vista_em, now())` em `eu.repository.ts:51`. Esta correção mexe só em `e2e/` e não muda nada disso. Não existe teste de clique duplo no "Pular" com a resposta atrasada. Agora que o `page.route` já segura a resposta, dá para prová-lo barato: dois toques seguidos, depois conferir que houve um só pedido de gravação, ou que a data gravada não mudou.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/coordenacao-introducao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/professor-introducao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 20:25:41 · `tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. Os dois casos leem `usuario.introducao_vista_em` pelo ajudante de teste que já existia (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/support/seed.ts:329`). Nenhuma migration, DTO, rota ou código de `apps/*/src` ou `packages/*/src` mudou.

Fora da tabela de dados do docs/lgpd.md: nada. A tarefa não cria campo pessoal.

Autorização por objeto: ok. A tarefa não toca rota nem repository. O `page.route('**/v1/eu/introducao')` só segura a resposta por 1 s e depois chama `rota.continue()`. A resposta e o escopo do servidor seguem os mesmos, e o teste não troca nenhum id.

Logs: limpos. Não entra nenhum `console` nem logger. Os comentários novos não citam pessoa.

Auditoria: nenhuma ação desta tarefa a exige. Marcar a introdução como vista não é leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum. A tarefa não chama provedor de IA nem serviço de terceiro.

Seed/fixture: sintético. Professora e coordenadora vêm de `criarEquipeComSenha` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/support/seed.ts:87`). O nome é "Professora/Coordenadora sintética <uuid>", o e-mail é `@educa.invalid` e as senhas são literais sintéticas (`SENHA_NOVA`). Não há dado real.

Bloqueantes: nenhum.

Recomendações:
- O ajudante novo do professor, `entrarPelaApiSemMedirAPrimeiraCarga` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/support/casca.ts:208`), avisa que o login da segunda pessoa num caso de isolamento tem de ser feito pela tela. Este caso tem uma pessoa só, então a troca não esvazia nenhuma prova da regra 10 nem do item 5 da regra 20. Fica como registro para quem copiar o padrão.
- O ajudante `introducaoVistaEmDoUsuario` lê por `id` sem `escola_id`. Isso é aceitável porque é só de teste e está documentado como tal (`seed.ts:325-328`). É a regra 10, não a minha, mas registro que a tarefa não espalhou o padrão para fora de `e2e/`.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta à secretaria continua a mesma de antes da tarefa.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/coordenacao-introducao.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/professor-introducao.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 20:25:43 · `tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção só mexe em dois specs do e2e, e eles gravam `usuario.introducao_vista_em` pela API, não `Nota`. Todos com autor humano? Não se aplica: a tarefa não abre caminho novo de escrita em `Nota`.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA passa por estes casos.
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim. A tarefa não toca agente nem a tela de governança.
Bloqueantes: nenhum
Recomendações:
- O `page.route` que atrasa a resposta em 1 s continua ligado até o fim do caso, inclusive no `page.goto('/')`. Hoje isso é inofensivo, porque a nova entrada não manda POST para `/v1/eu/introducao`. Mas um `page.unroute` depois do poll deixaria explícito que o atraso só vale para a gravação do "Pular". Não é assunto da regra 70; fica registrado para o `test-engineer`.
- Ponto a favor que vale citar na validação: os dois casos continuam provando que "Pular" no passo 1 grava a data e leva ao destino. É a parte da D59 (regra 70, item 4b) que diz que sair nunca é mais difícil que entrar. A correção faz o teste esperar até a data aparecer no banco, e se a gravação não acontecer, o poll estoura o prazo e o caso falha.

Notas da auditoria:
- `introducaoVistaEmDoUsuario` (`e2e/support/seed.ts:329`) só lê o banco e só existe para teste.
- `entrarPelaApiSemMedirAPrimeiraCarga` (`e2e/support/casca.ts:208`) recebe os mesmos argumentos que a nova chamada passa em `e2e/professor-introducao.spec.ts:113`. É o mesmo ajudante que o caso da coordenação já usa.
- Nenhum item da lista toca nota, correção, tutor, autonomia de agente, decisão sobre aluno ou indicador de professor. Por isso não há tela a conferir sob a D55 nem sob a D45.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/coordenacao-introducao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/professor-introducao.spec.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-10-31 20:25:44 · `tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção de teste e não muda nada na arquitetura. Também não há divergência que precise entrar na `techspec.md` ou no `cenarios.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

O que conferi:
- **A causa bate com o código.** `contarGravacoes` conta o pedido no evento `request`, que dispara quando o navegador envia o POST. Por isso o `expect.poll(() => gravacoes.length)` fica verde antes de o servidor gravar. Trocar a leitura direta do banco por um `expect.poll` na data continua provando a gravação: se ela não acontecer, o poll estoura o prazo e o caso falha.
- **O `page.route('**/v1/eu/introducao')` não pega outro pedido.** Essa rota só tem POST no servidor (`apps/api/src/sessao/eu/eu.controller.ts:21`). O atraso de 1 s reproduz a corrida de forma determinística, e o documento declara o vermelho com a asserção antiga.
- **A troca para `entrarPelaApiSemMedirAPrimeiraCarga` no professor está justificada.** Ela iguala o caso ao da coordenação, que já entrava pela `abrirPelaApiSemMedirAPrimeiraCarga`, e a primeira carga não é o assunto desse caso. O documento registra o motivo: a duração passava de 15 s no portão.
- **"Sem mutação" está correto.** Nenhum arquivo de `apps/*/src` nem de `packages/*/src` mudou.
- **Não há `.skip`, `any` nem `TODO`.** O caso do aluno não lê o banco, então ficar fora da correção está certo.

Recomendações:
- A constante `ATRASO_DA_GRAVACAO_MS` e o mesmo trecho de `page.route` com atraso estão copiados nos dois specs, como `contarGravacoes` já estava. Se um terceiro spec precisar disso, vale levar o trecho para um helper em `e2e/support/`.
- Agora o `await expect.poll(() => gravacoes.length).toBe(1)` antes do poll do banco ajuda pouco, porque a contagem final no fim do caso já cobre a gravação única. Pode ficar, mas o comentário poderia dizer que quem prova a gravação é o poll do banco.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/coordenacao-introducao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/professor-introducao.spec.ts

## test-engineer · 1ª rodada · APROVADO · 2026-10-31 20:26:23 · `tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: "Pular" no passo 1 grava a data uma vez e leva ao Painel (coordenação) ou a "Início" (professor). A entrada seguinte não volta para a introdução.
- Borda, a corrida da esteira: o pedido sai e a tela já navega, mas o servidor ainda não gravou. O teste antigo lia o banco nesse intervalo e recebia `null`.
- Borda, gravação que nunca acontece: o teste precisa falhar dentro do prazo, e não ficar verde porque o pedido saiu.
- Borda, gravação repetida: nem a entrada seguinte nem uma gravação tardia podem somar um segundo POST.
- Permissão e isolamento: não se aplicam. A correção só mexe na espera do teste, não muda rota, escopo nem dado.

Cobertos:
- A corrida agora é forçada em todas as execuções. O `page.route('**/v1/eu/introducao', ...)` segura a gravação por 1 s (`e2e/coordenacao-introducao.spec.ts:112-115`, `e2e/professor-introducao.spec.ts:117-120`). Assim o que antes falhava às vezes na esteira passa a ser determinístico. O relógio é segurado dentro do teste, sem depender da máquina estar lenta ou folgada.
- A asserção espera o dado no banco, e não o pedido: `expect.poll(() => introducaoVistaEmDoUsuario(...), { timeout: PRAZO_DA_ENTRADA_MS }).not.toBeNull()` (coordenação:122, professor:126). Se o servidor deixasse de gravar, o poll estouraria os 20 s e o caso falharia. A regra continua provada pelo resultado.
- "Uma vez" continua provado pela contagem final `expect(gravacoes).toHaveLength(1)`, depois do `page.goto('/')` (coordenação:127 e o equivalente no professor). O `expect.poll(...).toBe(1)`, que só olha o primeiro 1, não foi a única prova que sobrou.
- A rota só pega o POST: `/v1/eu/introducao` não tem GET. O web só chama `eu.ts:16`, com `metodo: 'POST'`. O atraso não contamina outra chamada.
- A troca para `entrarPelaApiSemMedirAPrimeiraCarga` no professor tira da régua só a primeira carga na rede lenta. O helper diz que isso vale quando o assunto do caso vem depois da entrada, e o assunto aqui é o "Pular". Não é um caso de segunda pessoa na mesma aba, então não esvazia prova de isolamento.
- "Sem mutação" está correto. O `git diff` só altera `e2e/`, e não há cláusula nova em `apps/*/src` nem em `packages/*/src`.
- Nenhum `.skip`, nenhum teste comentado, nenhum mock sobre a regra: a rota atrasa e continua para o servidor de verdade. Não há IA envolvida.
- Conferi os outros lugares que leem `introducaoVistaEmDoUsuario` (coordenação:106, 146, 166, 204, 264 e professor:111, 133, 152, 225). São leituras do estado anterior, ou de `toBeNull`/`toEqual(antes)` depois de um caminho que não grava. Nenhum tem a mesma corrida de ler um dado ainda não gravado.

Não rodei o Playwright. As provas de vermelho antes e verde depois (4 casos vermelhos com `Received: null`, depois 40/40 com `--repeat-each=10`) e o portão dentro da régua de duração são o que o documento relata.

Bloqueantes: nenhum.

Recomendações:
1. Em `e2e/coordenacao-introducao.spec.ts:112` e `e2e/professor-introducao.spec.ts:117`, filtrar o método no handler (`rota.request().method() === 'POST'`, senão `rota.continue()` sem atraso). Assim o atraso não pega um GET que alguém crie no mesmo caminho no futuro.
2. A prova de vermelho antes depende de o evento `request` do Playwright disparar antes do handler da rota. Um comentário curto ao lado do `contarGravacoes` dizendo isso ajuda quem for mexer depois.
3. `contarGravacoes` continua duplicado nos três specs de introdução (aluno, professor e coordenação). Vale juntar num lugar só quando alguém mexer nisso de novo; não é desta correção.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/coordenacao-introducao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/professor-introducao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 21:53:25 · `tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

VEREDITO: APROVADO

Cenários exigidos (os mesmos da 1ª rodada; esta rodada só olhou o diff):
- Caminho feliz: "Pular" grava a data uma vez e leva ao destino (Início do professor, Painel da coordenação).
- Corrida: a tela já seguiu, mas o servidor ainda não gravou.
- A entrada seguinte não desvia de novo para a introdução.

Cobertos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/professor-introducao.spec.ts`, teste `"Pular" no passo 1 grava a data, uma vez, e leva a "Início"`. O mesmo caso existe em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/coordenacao-introducao.spec.ts`.
- As três recomendações que a Mesa mandou aplicar foram feitas, nos dois specs:
  1. **`page.unroute('**/v1/eu/introducao')`:** vem logo depois do poll do banco e antes do `page.goto('/')`. O endereço é o mesmo do `page.route`. O atraso continua valendo para a gravação do "Pular", então a prova da corrida segue igual. Se o poll voltasse a ser leitura imediata, o caso continuaria vermelho, porque a resposta segue atrasada em 1000 ms até o poll. O `unroute` só tira o atraso da entrada seguinte.
  2. **Comentário do `contarGravacoes`:** explica que o evento `request` dispara no envio, antes do handler da rota e da gravação, e que por isso a contagem não prova a data no banco. Está correto e não muda nenhuma asserção.
  3. **Comentário do poll:** diz que quem prova a gravação é o poll do banco e que a contagem só diz que o pedido saiu.
- A recomendação de filtrar o método foi recusada, com motivo registrado no documento, na seção "Recomendações sem aplicar" (`tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md:55-63`). O motivo vale: `POST` é a única rota desse endereço, e o `unroute` restringe o atraso ao trecho da gravação.
- As duas entradas novas do `TODO.md` (o ajudante comum em `e2e/support/` e o clique duplo com a resposta atrasada) batem com a seção de recomendações não aplicadas.
- O diff não traz `.skip`, teste comentado, mock que esconda a regra, nem cláusula nova sem bloco de mutação.

Bloqueantes: nenhum.

Recomendações:
- O clique duplo no "Pular" com a resposta atrasada, com duas chamadas de fato em paralelo, continua sem teste e-2-e. Ele já está no `TODO.md`, e a data única já vem do `coalesce` em `eu.repository.ts:51`. Fica para a validação lembrar dele quando a introdução voltar a ser tocada.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 21:53:35 · `tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. Esta correção mexe só em `e2e/` e no registro dela, então não há seção da `techspec.md` a seguir.
Portão local: carimbo válido. Ele vale para o código atual e cobre typecheck, lint, segredo, dependências, unidade e alvo.
Bloqueantes: nenhum
Recomendações: nenhuma nova.

As três recomendações que a Mesa mandou aplicar foram feitas, iguais nos dois specs:
- **`page.unroute` depois da espera pelo banco:** está em `e2e/coordenacao-introducao.spec.ts:128` e em `e2e/professor-introducao.spec.ts:132`. Ele entra depois da espera pela data no banco e antes do `page.goto('/')`, então a entrada seguinte já não passa pelo atraso de 1 s.
- **Comentário do `contarGravacoes`:** está em `e2e/coordenacao-introducao.spec.ts:43-47` e no trecho igual do professor. Ele diz que o evento `request` dispara quando o navegador envia o pedido, e que por isso a contagem não prova a data no banco.
- **Comentário da espera pelo banco:** está em `e2e/coordenacao-introducao.spec.ts:124-125` e no trecho igual do professor. Ele deixa claro que quem prova a gravação é a leitura do banco, e que a contagem só diz que o pedido saiu.

A recusa de filtrar o método no handler da rota está justificada na seção "Recomendações sem aplicar". `POST /v1/eu/introducao` é a única rota desse endereço, e o `unroute` limita o atraso à gravação do "Pular". As duas recomendações que ficaram para depois estão no `TODO.md` com origem e motivo: levar o código copiado para um ajudante em `e2e/support/` e testar o clique duplo no "Pular". Fora do que foi pedido, o diff não muda nada que altere o comportamento dos casos.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/coordenacao-introducao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/e2e/professor-introducao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-introducao-pular-grava-a-data.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/TODO.md
