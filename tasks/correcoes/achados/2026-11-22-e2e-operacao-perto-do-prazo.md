# Achados das revisões — `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 00:49:15 · `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só em teste e no TODO. O único dado de pessoa no caminho é o operador de teste que `criarOperadorComSegundoFator` cria (`e2e/support/operacao.ts:95`): apelido aleatório `e2e-<uuid>`, nome "Operadora sintética …", e-mail em `@turmma.invalid` e senha gerada. Não há dado de aluno, professor ou escola.

Fora da tabela de dados do docs/lgpd.md: nada. Não há migration, campo novo nem DTO novo.

Autorização por objeto: ok. Nenhuma rota nem repository mudou. O caso novo do "Sair" ainda prova que, depois de sair, voltar a `/operacao` cai na tela de entrada e não devolve a sessão (`e2e/operacao.spec.ts:126-129`).

Logs: limpos. A correção não acrescenta nenhum log. O rótulo `onde` dos casos leva só o caminho, a largura e o tema.

Auditoria: não se aplica. Nenhuma das ações que a regra 20 item 10 cobre foi tocada.

Envio externo: nenhum.

Seed/fixture: sintético. O caso novo cria o próprio operador pelo mesmo ajudante, e o `test.afterEach` do arquivo (`e2e/operacao.spec.ts:40-42`) o apaga, passe ou falhe. Os quatro casos que saíram do `:125` não criam operador.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 20. Três pontos conferidos:
- O caso que cobre a entrada pela tela continua afirmando que nada da sessão fica no navegador. `semNadaGuardadoNoNavegador` olha `localStorage`, `sessionStorage` e se a URL tem token, desafio ou código, e segue chamado depois do segundo fator e na casca (`operacao.spec.ts:84` e `:93`).
- O `loadUnthrottled` (`e2e/support/profiles.ts:244`) só troca a velocidade da rede simulada e devolve a do perfil num `finally`. Ele não lê nem grava dado de pessoa.
- Pergunta de fechamento: a correção não muda nada do que o sistema guarda sobre um aluno nem para onde isso foi enviado. Fica como estava antes dela.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 00:49:16 · `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Ela só mexe em `e2e/operacao.spec.ts` e no `TODO.md`. Nenhum arquivo de `apps/*/src` ou `packages/*/src` mudou, e o teste trata só do login e da casca do operador Turmma, sem nota, aluno ou IA. Todos com autor humano? Não se aplica; nenhum caminho foi criado nem alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: não se aplica; nenhuma saída de IA é tocada
Supervisão do tutor: não se aplica; o tutor não é tocado
Autonomia declarada e visível: não se aplica; nenhum agente é tocado, então o que já existe continua igual

Bloqueantes: nenhum.

Um caso virou dois e outro virou quatro, e a primeira carga de cada tela agora corre dentro do `loadUnthrottled` (`e2e/support/profiles.ts:244`). Nenhuma asserção saiu nem mudou de texto. A tela da operação continua com o aviso "A operação não vê dado de aluno nem de professor: nem nome, nem nota, nem conversa." (`e2e/operacao.spec.ts:91`), e o "Sair" continua coberto: o alvo de 44 px, o anel de foco e a volta a `/operacao` sem a sessão (`e2e/operacao.spec.ts:99-131`). Isso mantém o item 4b da regra 70, de que sair não fica mais difícil. Não vieram fotos da tela, porque a tarefa não tem tela.

Recomendações:
- O nome do primeiro caso, em `e2e/operacao.spec.ts:45`, ainda diz "e sai a um clique". O trecho do "Sair" foi para o caso novo, em `:99`. Vale tirar o "e sai a um clique" do título, e também do `teste:` do segundo bloco de mutação da tarefa, para o relatório da esteira não apontar uma asserção que esse caso não faz mais.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-22 00:49:21 · `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção só de teste e não toca arquitetura. A receita é a mesma da `2026-11-06-e2e-perto-do-prazo-da-f2`: `loadUnthrottled` em `e2e/support/profiles.ts:244`, que já é usado em `professor-ferramentas.spec.ts`.

Portão local: carimbo válido. O `conferir` respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum

Conferi três pontos:
- Nenhuma asserção saiu na divisão. O trecho do "Sair" passou inteiro para o caso novo, em `e2e/operacao.spec.ts:99-132`.
- A volta da rede do perfil continua no `finally` (`profiles.ts:250-252`). Fora da primeira carga, os cliques, o argon2, o segundo fator e o axe seguem com a rede limitada.
- O `test.setTimeout(90_000)` saiu sem deixar nenhum caso dependente dele.

Recomendações:
- `e2e/operacao.spec.ts:45`: o título do caso ainda diz "e sai a um clique", mas o "Sair" agora está no caso da linha 99. Tirar o final do título para ele dizer só o que o caso prova. O bloco de mutação do documento cita esse título e muda junto.
- `e2e/operacao.spec.ts:148-149`: o comentário guarda números de uma medição ("doze recargas num caso só, 63 a 67 s de 90 na esteira") que deixam de valer com a própria correção. Esse histórico já está no documento da correção. No código basta dizer que o caso afirma a barra e não o tempo de download.
- `TODO.md`: o item marcado como `[x]` está numa seção chamada "fora dela", mas registra o que a própria correção fez. Vale conferir se é o padrão das outras correções. Se não for, só o item de acompanhamento do `:167` e do `:45` precisa ficar no TODO.

Arquivos revisados:
- e2e/operacao.spec.ts
- TODO.md
- tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 00:49:22 · `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md`

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
- `e2e/operacao.spec.ts:45`: o título ainda diz "e sai a um clique", mas a saída foi para o caso da linha 99. Tire "e sai a um clique" do título do `:45`, para que o relatório da esteira diga o que cada caso prova.
- O caso novo da linha 99 faz um login a mais de operador por projeto, e esses logins saem todos do mesmo IP. Hoje isso não causa problema, porque cada caso cria o próprio operador e o limite de login é por usuário. Se um dia o limite da operação passar a contar também por IP, este arquivo vai ser o primeiro a sentir. Cabe uma nota no `TODO.md`, junto do item de acompanhamento do `:167`.

O que eu verifiquei:
- Só arquivo de teste e documento mudaram. Nada em `apps/*/src`, `packages/*/src`, migration ou deploy.
- Nenhum teste chama provedor pago.
- O `loadUnthrottled` (`e2e/support/profiles.ts:244`) devolve a rede do perfil num `finally`, então a rede lenta volta mesmo se o caso falhar no meio. Ele cobre só o `goto` e a espera do título. O resto do caso continua na rede e na CPU do perfil.
- Cada caso novo cria o próprio operador, e o `afterEach` da linha 40 remove todos. Com dois trabalhadores, nenhum caso disputa estado com outro.

## test-engineer · 1ª rodada · APROVADO · 2026-11-22 00:49:55 · `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md`

VEREDITO: APROVADO

**Cenários exigidos.** Esta correção só mexe em teste e não muda regra do produto. Por isso, no lugar de caminho feliz, borda, permissão e isolamento, o que ela precisa provar é isto:
- Nenhuma asserção dos dois casos antigos se perde nem enfraquece ao dividi-los.
- As esperas que passaram a rodar dentro do `loadUnthrottled` continuam vivas, ou seja, uma tela errada ainda fica vermelha.
- O caso novo do "Sair" chega mesmo à casca e afirma o anel de foco.
- Os casos novos cabem no prazo do portão sem depender de máquina folgada.
- O que o caso faz com a página aberta (cliques, medidas, axe) continua sob o perfil de CPU e de rede.

**Cobertos.**
- **Asserções preservadas.** Comparei o diff linha a linha. Todas as asserções do antigo `:45` estão no novo `:45` ou no `:99`, sem mudar texto. O `:99` mantém alvo de 44 px, anel de 3 px, barra clara com borda de 2 px, sair, voltar a `/operacao` e nenhum alerta. O antigo `:125` virou quatro casos com o mesmo corpo, inclusive o axe no escuro.
- **Mesmo caminho até a casca.** O `:99` entra por `entrarNaOperacao` (`e2e/support/operacao-screen.ts:22`). Ele passa pela tela, pelo segundo fator e por `esperarCasca`, então o "Sair" é testado na casca de verdade.
- **Três mutações, todas pegando o que dizem.**
  - Bloco 1: troca o título do segundo fator, a linha da lista de telas que os quatro casos gerados pelo laço usam.
  - Bloco 2: troca o título da primeira carga. Esse trecho só existe no `:45`, porque a linha 127 não tem `timeout`.
  - Bloco 3: troca a largura do anel no `:99`.
  - Os nomes citados em `teste:` batem com os listados por `npx playwright test e2e/operacao.spec.ts --list`, nos dois projetos.
- **Mutação de produção.** Nenhum arquivo de `apps/*/src` ou `packages/*/src` muda, e o documento registra `--faltando: 0 linhas`. O RF17 não se aplica.
- **Perfil depois da carga.** O `loadUnthrottled` (`e2e/support/profiles.ts:244`) devolve a rede do perfil no `finally`. O que vem depois da carga continua sob o perfil.
- **Primeira carga lenta ainda testada.** O `:167` e os casos seguintes do arquivo ainda carregam `/operacao/entrar` sob a rede lenta.
- **Prazo.** Os casos novos medem de 3,1 a 12,2 s, contra o limite de 15 s do portão, e passaram 60 de 60 com `--repeat-each 5 --workers 2`. O `:45` ficou mais perto do limite (12 a 14 s com 6 trabalhadores), e o `TODO.md` já registra o acompanhamento no próximo censo, com dono.
- **Proibições.** Não há `.skip`, teste comentado, mock da regra nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações.**
1. O título do caso em `e2e/operacao.spec.ts:45` ainda diz "…chega à casca da operação e sai a um clique", mas ele não sai mais: o "Sair" foi para o `:99`. Vale tirar o "e sai a um clique" do nome e atualizar junto o `teste:` do segundo bloco de mutação no documento da correção, que cita esse nome.
2. O anel de foco (`e2e/operacao.spec.ts:111-123`) só roda no projeto `chromebook`, por causa do `if (!hasTouch)`. A mutação 3 fica vermelha só lá, e no `celular` ela passaria. Isso já era assim antes e está certo para toque, mas o documento poderia dizer em qual projeto o bloco 3 morde.
3. O laço do `Tab` até o "Sair" (`:112`) parte do foco que o `entrarNaOperacao` deixa, não mais do foco deixado pela entrada pela tela no mesmo caso. Hoje passa, e a mutação 3 prova que a asserção é alcançada. Se a casca ganhar mais de 10 elementos focáveis antes do "Sair", o caso falha com uma mensagem que não aponta a causa. Vale citar o limite no comentário.

Arquivos relevantes:
- e2e/operacao.spec.ts
- tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md
- e2e/support/profiles.ts
- e2e/support/operacao-screen.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 01:04:53 · `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção só de teste: nenhum arquivo de `apps/*/src` ou de `packages/*/src` mudou.

Portão local: carimbo válido. O `conferir` respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

As três recomendações da 1ª rodada foram feitas:
- **Título do caso:** `e2e/operacao.spec.ts:45` agora termina em "e chega à casca da operação". O bloco de mutação em `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md` mudou junto e cita o título novo.
- **Comentário com medições:** o de `e2e/operacao.spec.ts:150-151` não traz mais os ~5 s por tela nem os 63 a 67 s de 90. Diz só que o caso afirma a barra e não o tempo de download.
- **Item `[x]` no `TODO.md`:** saiu da seção "fora dela", que ficou só com pendências `[ ]`.

Fora do que eu pedi, a rodada também:
- acrescentou ao documento que a terceira mutação, a da largura do anel, só fica vermelha no projeto `chromebook`, porque no `celular` a asserção do anel está dentro de `if (!hasTouch)`. A nota está correta;
- acrescentou ao `TODO.md` a pendência do `infra-guardian` sobre o login de operador por IP, com dono.

Recomendações:
- `e2e/operacao.spec.ts:114`: falta um espaço em `tecla < 10 &&!(await ...`. O lint passou, então o formato não é verificado ali. É só legibilidade, numa linha que já é longa.
- `e2e/operacao.spec.ts:112-113`: o comentário novo é útil, porque explica por que uma falha aparece como `visivel: false`. Ficaria mais claro se o 10 virasse uma constante com nome, como `MAXIMO_DE_TAB_ATE_O_SAIR`; aí o comentário fica menor.

Arquivos:
- e2e/operacao.spec.ts
- TODO.md
- tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 01:04:57 · `tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md`

VEREDITO: APROVADO

**Cenários exigidos (pelo diff da 2ª rodada):**
- O caso do `:45` renomeado sem perder o bloco de mutação que o cita.
- O bloco 3 dizendo em qual projeto ele morde.
- O limite do laço do `Tab` explicado no comentário.
- Os comentários do `:147` sem a medição que ficou velha.
- O item novo do `TODO.md`, vindo do `infra-guardian`.

**Cobertos:**
- **Renomeação:** o caso do `:45` agora se chama "entra por e-mail, senha e código e chega à casca da operação" (`e2e/operacao.spec.ts:45`). O `teste:` do segundo bloco foi trocado junto (`tasks/correcoes/2026-11-22-e2e-operacao-perto-do-prazo.md:68`). Os três `teste:` do documento (linhas 59, 68 e 77) batem com o título dos casos que existem no arquivo. Nenhuma mutação ficou apontando para um caso que não existe.
- **Bloco 3:** o documento agora diz que ele só fica vermelho no projeto `chromebook`, porque o anel está dentro de `if (!hasTouch)`, e que o `chromebook` é o projeto padrão do portão.
- **Limite do `Tab`:** o comentário em `e2e/operacao.spec.ts:112-113` explica o limite de 10 teclas. O que ele afirma é verdade: se o "Sair" não receber o foco, o `:focus-visible` dá falso e o caso cai no `toEqual` do anel, na linha 119, com `visivel: false`. Ou seja, o limite não deixa o caso passar à toa; ele falha, e agora o comentário aponta a causa.
- **Comentário do `:147`:** saiu a medição de 63 a 67 s, que já não valia depois da divisão do caso. O código não mudou.
- **`TODO.md`:** o item do `infra-guardian` sobre os logins de operador saindo do mesmo IP está registrado, com dono e com o gatilho para conferir.
- **Asserções:** nenhuma mudou nesta rodada. Não há `.skip`, teste comentado, mock novo nem chamada a provedor de IA.
- **Lint:** rodei `npx eslint e2e/operacao.spec.ts` e passou sem aviso.

**Bloqueantes:** nenhum.

**Recomendações:**
- Em `e2e/operacao.spec.ts:114`, falta um espaço em `tecla < 10 &&!(await ...`; o certo é `&& !(`. O lint não pega, então é só aparência.
