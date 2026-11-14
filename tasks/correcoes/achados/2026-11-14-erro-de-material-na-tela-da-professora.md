# Achados das revisões — `tasks/correcoes/2026-11-14-erro-de-material-na-tela-da-professora.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-14 13:02:14 · `tasks/correcoes/2026-11-14-erro-de-material-na-tela-da-professora.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas, cheia e vazia, computador e celular). As fotos mostram o formulário da Adaptação. O estado alterado por esta correção, `FalhaDoPedido` com `LICENCA_VENCIDA` ou `EDICAO_SUBSTITUIDA`, não aparece na vitrine. Julguei esse estado pelo código e pelo teste.
Estados: ok. Carregando, vazio, erro e com dado não mudaram. O estado vazio da foto convida ("Ainda não há atividade para adaptar", com o botão "Gerar uma atividade"). O estado de erro alterado vem do código, abaixo.
Acessibilidade: ok. O texto novo sai no mesmo `<p role="alert">` de antes, com `bg-erro-cx` e `text-erro` (`apps/web/src/areas/professor/comum/avisos.tsx:89-92`), com `break-words` e `min-w-0`. Os campos do formulário têm rótulo e os checkboxes têm foco.
Chromebook fraco: sem impacto. A mudança é uma troca de string e uma consulta a um array de 2 itens.
Celular: ok. As fotos a 360 px não mostram rolagem horizontal. Os alvos de toque estão acima de 44 px e o botão principal "Gerar versão adaptada" é de largura confortável. A barra inferior se sobrepõe ao formulário só na foto de página inteira, por ser fixa, e isso não é defeito. O aviso novo é um bloco de texto com `break-words`, que não estoura a largura.
Ação oficial protegida: sim. A correção só troca o texto de uma recusa. Não há ação oficial nova e a Adaptação continua nascendo pendente de aprovação.

Verificações feitas no código:
- **Os dois códigos viram `explicada`:** `aparenciaDaFalha` (`apps/web/src/api/ciclo-de-execucao.ts:130-134`) só devolve `fila` para os códigos de `PASSAGEIROS`, e `LICENCA_VENCIDA` e `EDICAO_SUBSTITUIDA` não estão nessa lista. Por isso não há "Tentar de novo", e o teste prova isso.
- **Os dois caminhos chegam ao mesmo componente:** o `POST` recusado e a execução que falha depois do 202 passam por `CartaoDeFerramenta.tsx:119`. A conversa (`Conversa.tsx:168`) também usa `FalhaDoPedido`, e o texto vale para ela.
- **Texto:** "O material que esta atividade cita saiu de uso. Gere a atividade de novo para poder adaptá-la." Está em português, sem código nem termo técnico. Diz o que houve e o que fazer, e não manda a professora a "Licenças", que é tela da coordenação.
- **Catálogo:** `packages/shared/src/errors/messages.ts` e `material-envio.ts:236` não foram alterados. O texto da coordenação continua certo para quem envia material.
- **Testes:** o `describe` novo cobre os dois códigos no `POST` e `LICENCA_VENCIDA` na execução. Confere o texto exato, a ausência de "Licenças", de "vigência" e do código, e a ausência de botão de repetir. As três mutações declaradas na correção correspondem a linhas reais do diff.

Bloqueantes: nenhum

Recomendações:
- O teste da execução cobre só `LICENCA_VENCIDA`. `EDICAO_SUBSTITUIDA` pela execução passa pelo mesmo ramo e não oferece risco real, mas um `it.each` nos dois códigos fecharia a simetria.
- A frase fala em "esta atividade". Na conversa do Assistente, onde `FalhaDoPedido` também aparece, ela é ambígua, porque a professora pode não ter uma atividade à vista. Hoje só a Adaptação produz esses códigos, então fica como observação para quando outra ferramenta passar a produzi-los.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-14 13:02:24 · `tasks/correcoes/2026-11-14-erro-de-material-na-tela-da-professora.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- A troca de `type ErrorCode` por import de valor em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/web/src/areas/professor/comum/avisos.tsx:1` está certa: `ErrorCode` é um `const` exportado em `packages/shared/src/errors/error-code.ts:5`.
- Os dois códigos já caem em `explicada` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/web/src/api/ciclo-de-execucao.ts:130`, porque não estão em `PASSAGEIROS`. Por isso a tela não oferece "Tentar de novo" e não manda o pedido de novo ao gateway, coisa que não adiantaria nada. Se alguém puser um desses códigos em `PASSAGEIROS`, a tela passa a reenviar o mesmo pedido em loop às 10h. O teste da tarefa pega isso, porque confere que o botão some.
- A mudança é só do texto que a tela mostra. Não cria requisição, polling, job, query, estado no servidor nem métrica. Por isso não precisa de teste de concorrência nem de mudança no cenário de carga.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-14 13:02:39 · `tasks/correcoes/2026-11-14-erro-de-material-na-tela-da-professora.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção só troca o texto de erro que a professora vê; não grava nada, não mexe em API, job, seed, importação nem webhook. Todos com autor humano? Não se aplica, porque nenhum foi criado nem alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A correção não muda o ciclo da entrega. As fotos mostram que a professora vê a regra antes de pedir, em "Como vai sair": "Nasce esperando a sua aprovação e fica em Criados", e só depois "vai à turma quando você escolher 'Aplicar à turma'". Isso aparece em `professora--professor-ferramentas-adaptacao--computador.png` e `--celular.png`. Quando o pedido é recusado, nada nasce: não há execução nem entrega.

Supervisão do tutor: ok, a correção não toca o tutor.

Autonomia declarada e visível: sim, sem mudança. A tela da professora diz em português comum o que a IA faz e o que espera dela.

O que conferi da regra 70 na tela, nas quatro fotos (escola cheia e vazia, computador e celular):
- Não há nota, conceito nem sugestão de nota. A Adaptação é de atividade objetiva, então a D55 não entra.
- O formulário não tem campo de texto sobre o aluno. A tela diz isso: "Escolha a adaptação, e não o motivo dela: aqui não se escreve sobre o aluno" (D35).
- Nada induz uso nem dificulta sair: "Sair" fica visível nos dois tamanhos de tela.
- O novo texto de falha não expõe o código, não manda a professora a "Licenças", que é da coordenação, e não oferece "Tentar de novo" num pedido que não vai dar certo. Os três casos de `apps/web/src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx` cobrem isso, e as três mutações declaradas derrubam esses casos.
- Conferi onde o servidor gera os dois códigos para a professora. Fora do envio de material da coordenação (`apps/api/src/material/material.service.ts:173`, `:356`), só a Adaptação os devolve (`apps/api/src/artefato/artefato.service.ts:77-78`). Por isso o texto fixo "para poder adaptá-la" está certo hoje.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/areas/professor/comum/avisos.tsx:60` e `:91`: `FalhaDoPedido` também aparece na conversa do Assistente (`apps/web/src/areas/professor/assistente/Conversa.tsx:168`), e o texto fala só em adaptação. Se outro fluxo da professora passar a devolver `LICENCA_VENCIDA` ou `EDICAO_SUBSTITUIDA`, a frase vai mentir. Vale escrever esse limite no comentário do texto, ou escolher o texto pela função do pedido, para a próxima tarefa que reutilizar esses códigos.
2. As fotos não mostram o estado de falha, como o próprio aviso da vitrine admite. Hoje quem prova o texto é o teste de componente. Se a vitrine ganhar como forçar uma recusa, vale fotografar esse estado.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/web/src/areas/professor/comum/avisos.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/web/src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-14-erro-de-material-na-tela-da-professora.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-14 13:02:41 · `tasks/correcoes/2026-11-14-erro-de-material-na-tela-da-professora.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** a professora pede a Adaptação, o pedido é recusado com `LICENCA_VENCIDA` ou com `EDICAO_SUBSTITUIDA`, e ela lê o texto próprio dela. Esse texto não fala em "Licenças", não mostra o código e não oferece "Tentar de novo".
- **Borda 1, licença vencida no meio:** o `POST` volta 202, a licença vence antes da execução e a execução falha com `LICENCA_VENCIDA`. A tela mostra o mesmo texto.
- **Borda 2, edição substituída:** o material da atividade foi substituído por edição nova. O texto é o mesmo, porque o que a professora precisa fazer é o mesmo: gerar a atividade de novo.
- **Borda 3, catálogo intacto:** a coordenação, quando envia material, continua lendo o texto do catálogo que manda ir a "Licenças".
- **Permissão e isolamento:** não se aplicam. A mudança é só de texto no cliente, sem leitura nova nem dado de escola. A recusa e o isolamento já foram provados na correção anterior (`artefato.int.test.ts`).
- **Concorrência:** não se aplica. Não há operação nova que possa acontecer duas vezes.

**Cobertos:**
- Todos os testes estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/web/src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx`, no describe "a Adaptação de uma atividade cujo material saiu de uso". Rodei o arquivo: 14 de 14 passam.
- **Recusa no pedido:** o `it.each` "LICENCA_VENCIDA na recusa do pedido" e "EDICAO_SUBSTITUIDA na recusa do pedido". Cada caso confere o texto exato com `toBe`, a ausência de "Licenças" e de "vigência", a ausência do código e a falta do botão de repetir o pedido.
- **Falha na execução:** o teste "LICENCA_VENCIDA que aparece na execução, depois do 202, quando a licença venceu no meio". O `POST` responde 202 e a consulta da execução devolve `estado: 'falhou'` com `erro: 'LICENCA_VENCIDA'`, então o cenário chega de fato ao caminho da execução.
- **Mutações:** o `git diff` tem duas cláusulas novas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/web/src/areas/professor/comum/avisos.tsx`: a lista `MATERIAL_FORA_DE_USO` (linha 60) e o ternário de `FalhaDoPedido` (linha 91). A seção "Mutações" tem três blocos: um para cada código da lista e um para o ternário. Cada bloco cita um teste que existe e que chega à cláusula. Não falta bloco.
- **"Sem Tentar de novo":** a tela já fazia isso antes, porque nenhum dos dois códigos está entre os erros passageiros de `aparenciaDaFalha`. Por isso eles caem em `explicada`. O teste garante que o comportamento continua.
- **Outros pontos:** não há `.skip`, mock que esconda a regra nem chamada a provedor de IA. A rede é falsa e só simula as respostas da API.
- **Linha nova em `cenarios.md`:** cada item dela tem teste, exceto "o catálogo geral não muda". Esse item não precisa de teste novo: o diff não mexe em `packages/shared/src/errors/messages.ts`, e o texto da coordenação já é coberto pelos testes de `areas/coordenacao/material/`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A falha na execução só é testada com `LICENCA_VENCIDA`. Vale estender o caso a `EDICAO_SUBSTITUIDA` com um `it.each`, como já foi feito na recusa do pedido. Hoje os dois passam pelo mesmo código, mas o teste garantiria que continue assim.
2. `FalhaDoPedido` também aparece na conversa (`Conversa.tsx`), e o texto novo fala em "adaptá-la". Hoje só a adaptação de artefato devolve esses códigos à professora (`artefato.service.ts:77-78`), então a conversa não chega a esse texto. Se outra ferramenta passar a devolvê-los, o texto vai dizer a coisa errada. Vale um comentário em `avisos.tsx:60` dizendo que a lista vale só enquanto só a Adaptação devolve esses códigos, ou um teste que avise quando outra ferramenta passar a devolvê-los.
3. As fotos não mostram o estado de falha, e o próprio aviso já diz que a vitrine não chega a ele. A cobertura desse estado fica só no teste de componente. Se a vitrine ganhar como simular a falha, vale tirar a foto também, para o `frontend-reviewer` conferir.

## test-engineer · 2ª rodada · APROVADO · 2026-11-14 13:10:03 · `tasks/correcoes/2026-11-14-erro-de-material-na-tela-da-professora.md`

VEREDITO: APROVADO

**Cenários exigidos:** a professora recebe o texto dela (sem "Licenças", sem "Tentar de novo" e sem o código) quando a Adaptação é recusada por `LICENCA_VENCIDA` ou `EDICAO_SUBSTITUIDA`. Isso vale nas duas falhas: na recusa do pedido (422) e na execução, depois do 202, quando o material sai de uso no meio. O catálogo da coordenação continua igual. Esta rodada só precisava conferir a recomendação da 1ª: estender a falha na execução a `EDICAO_SUBSTITUIDA`.

**Cobertos:**
- **Recusa do pedido:** `it.each` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/web/src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx:230`, com os dois códigos e as quatro asserções sobre o resultado: texto exato, sem Licenças ou vigência, sem o código e sem botão de repetir.
- **Execução:** agora também é `it.each`, em `CartaoDeFerramenta.test.tsx:242`, com `LICENCA_VENCIDA` e `EDICAO_SUBSTITUIDA`. Confere o texto exato e a ausência de "Tentar de novo" ou "Pedir de novo". A recomendação da 1ª rodada foi feita.
- **Limite do texto:** está escrito no JSDoc de `TEXTO_DO_MATERIAL_FORA_DE_USO` (`apps/web/src/areas/professor/comum/avisos.tsx:57-61`). A mudança é só comentário, sem efeito em comportamento.
- **Documento da correção:** a seção "Teste que reproduz" cita os quatro casos pelo nome, e a contagem de 15 casos bate com a execução local: `npx vitest run src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx` dá 1 arquivo e 15 testes verdes.
- **Mutações:** o código de produção não mudou nesta rodada, então os três blocos continuam valendo. O 3º cita "LICENCA_VENCIDA que aparece na execução", que ainda é prefixo do nome gerado pelo `it.each`, e o filtro do portão continua achando o caso. Esse bloco tira o desvio inteiro, então também deixa vermelho o caso novo de `EDICAO_SUBSTITUIDA` na execução.
- **Restante:** não há `.skip`, teste comentado nem mock da regra. A rede falsa (`fakeNetwork`) só substitui a API, e o componente `FalhaDoPedido` é o real. Não há IA, isolamento entre escolas nem concorrência nesta mudança, que é só de texto na tela.

**Bloqueantes:** nenhum.

**Recomendações:**
- O caso da execução (`CartaoDeFerramenta.test.tsx:248-249`) não repete as asserções sem "Licenças" e sem o código que o caso da recusa tem. A comparação exata com `toBe(TEXTO_DA_PROFESSORA)` já cobre as duas, então é só simetria entre os dois casos.
