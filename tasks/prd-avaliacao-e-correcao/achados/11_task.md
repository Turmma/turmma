# Achados das revisões — `tasks/prd-avaliacao-e-correcao/11_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 03:33:44 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: o nome do aluno, só na tela do professor da turma, nos cartões de "Acompanhar", no diálogo de estender e na lista da segunda chamada. Aparecem também a situação na prova (`nao_comecou`, `fazendo`, `enviou`, `tempo_esgotado`) e o `limiteEm`. O tempo adicional aparece só no diálogo da segunda chamada, como percentual que a professora escolhe para quem ela marcou. A confirmação diz quantos alunos têm tempo adicional, nunca quais (`SegundaChamada.tsx:427`). A tarefa não cria campo, tabela nem migration.

Fora da tabela de dados do docs/lgpd.md: nada. A tarefa só lê contratos que já existem. O `acompanhamentoDoAlunoSchema` é `strictObject`, com `alunoId`, `nome`, `situacao` e `limiteEm`, sem matrícula, sem percentual e sem saídas da aba (`packages/shared/src/atividade/atividade-aplicada.ts:192-203`).

Autorização por objeto: ok. A tela só passa o id da atividade que a lista da turma trouxe. A rota `GET :id/acompanhamento` exige `atividade_aplicada.acompanhar`, que na matriz é `turma_vinculada` para o professor e `nunca` para coordenador, rede e aluno (`packages/shared/src/permissao/matriz.ts:275,324,373,422`). Por isso a leitura nominal por coordenação ou rede não existe, e a auditoria de leitura não se aplica. Estender e segunda chamada usam as rotas já auditadas na 5.0 e na 9.0. "Não encontrado" e "sem permissão" respondem igual, também pelas rotas da 5.0 e da 9.0.

Logs: limpos. Nenhum `console` nem log nos arquivos novos e alterados. Nada vai para `localStorage`, `sessionStorage` ou URL. A consulta usa `gcTime: 0`, então o nome sai da memória quando o painel fecha (`api/acompanhamento.ts:31`). A rota tem `Cache-Control: no-store`.

Auditoria: presente. A extensão grava auditoria só com o escopo (aluno ou turma), sem minutos e sem o aluno, porque tempo adicional é adaptação (`apps/api/src/atividade/atividade-aplicada/extensao.service.ts:26-27`). A segunda chamada também tem a sua, da 9.0. A tela não acrescenta ato novo que precise de auditoria.

Envio externo: nenhum. Não há chamada de IA nem envio a terceiro.

Seed/fixture: sintético. Os alunos do e2e são "Ana Souza", "Bia Lima" e "Fantasma Antigo", com o id `0197a1c0-…ffff` montado à mão. `atividade-db.ts` e `aluno-api.ts` só ganharam parâmetros e rotas de apoio.

Outros pontos conferidos:
- **A aba Hoje, que a professora projeta em sala, não lê o acompanhamento.** O teste `Acompanhamento.test.tsx:235` prova isso.
- **A tela não mostra percentual, saída da aba, "parado há" nem palavra de falta.** O teste `Acompanhamento.test.tsx:129` confere o texto da seção.
- **A lista segue a ordem do nome**, não a de quem terminou antes.
- **A saída da aba só aparece no lote**, como define a D70.

Pergunta de fechamento: a tarefa não muda a resposta. Ela não cria dado guardado nem destino de envio. A extensão e a segunda chamada continuam registradas pela API (linha da extensão com autor e auditoria), dentro do que o arquivo do titular já cobre.

Bloqueantes: nenhum.

Recomendações:
1. `e2e/professor-prova.spec.ts:72`: o título do caso diz "(a Ana com +50%)", mas a tela não mostra percentual, e não deve mostrar. Vale trocar o título por algo como "a Ana com tempo adicional", para ninguém ler isso como algo que a tela precisa exibir.
2. Homônimos marcados como "(1 de 2)" e "(2 de 2)" (`prova-online.ts`, `alunosDoAcompanhamento`): a regra 20 não pede mais que isso, mas a professora pode estender o tempo da Ana errada. Se o produto quiser um jeito melhor de distinguir, que seja um campo pensado para isso no contrato, como o apelido da turma. A matrícula não deve entrar no acompanhamento. O caso fica para a retro.
3. A divergência da segunda chamada (a aluna cortada pela professora não aparece para convocar) já está registrada na tarefa. Se a correção for expor a "cortada" no acompanhamento, ela deve chegar como situação própria, sem motivo, e passar por esta auditoria de novo.

Arquivos auditados, todos em `apps/web/src/areas/professor/atividades/`:
- `Acompanhamento.tsx`
- `Estender.tsx`
- `SegundaChamada.tsx`
- `EncerramentoDaAtividade.tsx`
- `AtividadesDaTurma.tsx`
- `prova-online.ts`
- `api/acompanhamento.ts`

Também `e2e/professor-prova.spec.ts` e os dois arquivos de apoio em `e2e/support/`.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-28 03:33:46 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

Tela vista: não. O prompt trouxe `Fotos da tela: indisponíveis`, porque a vitrine sintética não tem prova avaliativa com janela e a aba Atividades saiu em "Carregando a aba…". Não tentei fotografar de novo. Revisei pelo código, pelo `e2e/professor-prova.spec.ts` e pelos testes unitários. Os 196 testes de `apps/web/src/areas/professor/atividades` passam e o `tsc --noEmit` do `apps/web` está limpo. O e2e não rodou aqui. A validação precisa ver a tela a 360 px e a 1366 px.

Estados: ok. Carregando e erro vêm do código e do e2e, porque a vitrine não os mostra.
- **Acompanhar:** `Acompanhamento.tsx` tem carregando, erro com "Tentar de novo" (só quando não há leitura nenhuma), vazio e com dado. A releitura que falha mantém o último dado.
- **Segunda chamada:** o diálogo em `SegundaChamada.tsx` tem carregando, erro, "ninguém para convocar" e com dado.
- **Encerrar:** `EncerramentoDaAtividade.tsx` tem carregando e erro na confirmação.

Acessibilidade: sem achado bloqueante.
- O foco volta ao botão de origem ou ao `focoDeReserva` quando o diálogo fecha.
- O botão "Estender" tem `aria-label` "Estender o tempo de <nome>", que começa pelo texto visível.
- O campo de minutos tem rótulo e dica.
- A situação sai em texto, e o selo não depende só de cor.
- Os erros usam `role="alert"`.
- O e2e roda `seriousViolations` (axe) nos dois projetos.

Chromebook fraco: ok.
- A releitura é a cada 15 s, só com a prova aberta e a aba à vista.
- A lista é de uma turma, então não precisa de virtualização.
- `gcTime: 0` tira os nomes da memória quando o painel sai da tela.
- O e2e foi escrito com casos curtos para caber no CPU ×4.

Celular: ok pelo código.
- Os cartões usam `flex-wrap`, `min-w-0` e `break-words`.
- "Estender" e "Segunda chamada" têm 44 px, e a confirmação do `ConfirmDialog` usa o `Button` padrão de 44 px.
- A lista de convocados é de uma coluna, com `OptionCard` de 64 px.
- Nada depende de hover.
- O e2e checa a 360 px: `paginaNaoRola`, `larguraExcedenteDoDialogo` e o alvo de 44 px.

Ação oficial protegida: sim.
- **Estender:** o `ConfirmDialog` mostra atividade, turma e para quem. O efeito vem antes de confirmar ("Ana Souza termina às 10:52 em vez de 10:42"). A trava `decidindo` e a chave por pedido evitam duplicidade.
- **Segunda chamada:** a confirmação traz os convocados por nome, a janela e a duração. De tempo adicional, diz só quantos, nunca quais (D35).
- **Encerrar:** diz "N alunos ainda estão fazendo…".

Regras 50 e 70:
- A seção Acompanhar não aparece na aba Hoje.
- O acompanhamento não mostra saída da aba, percentual de tempo adicional nem "parado há X min".
- "Tempo esgotado" não sugere falta nem consequência.
- Alunos de mesmo nome viram "(1 de 2)" e "(2 de 2)".
- A ordem é por nome, nunca por situação.
- `docs/interface.md` §1.7 foi atualizado e confere com o código.

Bloqueantes: nenhum.

Recomendações:
1. `Acompanhamento.tsx`, em `EstadosDaLeitura`: o vazio "Esta turma ainda não tem alunos para acompanhar." só informa. Dizer o próximo passo, por exemplo onde a coordenação vincula os alunos, seguiria melhor a regra do estado vazio que convida.
2. `Acompanhamento.tsx`: quando a releitura falha e o painel segue com o dado anterior, nada avisa que ele pode estar velho. Uma linha discreta, como "Não foi possível atualizar. Mostrando a última leitura", ajudaria. Com a prova aberta isso pesa mais.
3. `EncerramentoDaAtividade.tsx`: se o acompanhamento ainda não chegou quando a professora confirma, a frase "N ainda fazem" não aparece, e o diálogo não diz que está lendo. Hoje o painel já mantém a leitura em cache, então o risco é pequeno. Vale um "Conferindo quem ainda faz…" em `aviso` enquanto `isFetching`.
4. `prova-online.ts`, em `efeitoDeEstender`: para aluno em `tempo_esgotado` com a prova ainda aberta, o texto "ganha N minutos a mais na prova" supõe que a API reabre o tempo dele. Confirmar com a técnica da 5.0 e, se for o caso, dizer isso na frase.
5. `Estender.tsx`, em `CamposDaExtensao`: o `SegmentedControl` usa o nome do aluno como rótulo. Nomes compostos mais "(1 de 2)" quebram em duas linhas dentro do botão. Funciona, mas confira na foto a 360 px.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 03:33:52 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo. A tarefa é só de tela. Ela não cria nem altera rota, job, seed, importação ou webhook que grave `Nota`. O único caminho até a nota que o e2e percorre é a aprovação do lote pela tela de revisar, que já existia (14.0, D33 e D56). Ele passa pela confirmação "Aprovar 2 correções", feita pela professora (`e2e/professor-prova.spec.ts:414-420`). Todos com autor humano? sim.

Decisão autônoma sobre aluno: ausente.
- Estender o tempo é sempre a professora que pede, e o diálogo mostra o efeito antes de ela confirmar (`Estender.tsx`).
- Na segunda chamada, a professora escolhe os convocados um a um. A tela não marca ninguém sozinha (`SegundaChamada.tsx:152`, a lista começa vazia).
- Encerrar só informa quantos alunos ainda estão fazendo a prova e não muda nada sozinho (`EncerramentoDaAtividade.tsx:260-264`).

Aprovação registrada: ok. Nenhuma saída de IA nova chega ao aluno nesta tarefa. A exceção do tutor (D47) não aparece em nenhum lugar.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente novo.

Supervisão não é vigilância (item 7) e D70:
- **O que o acompanhamento mostra.** Só a situação de cada aluno: "Não começou", "Fazendo · termina às HH:MM", "Enviou" ou "Tempo esgotado". Não há "parado há", percentual de tempo adicional nem contagem de saídas da aba. O contrato de resposta não deixa passar campo a mais (`packages/shared/src/atividade/atividade-aplicada.ts:192-204`). Dois testes provam isso, `Acompanhamento.test.tsx:129-135` e `e2e/professor-prova.spec.ts:355`.
- **Ordem da lista.** Por nome, nunca por situação ou por quem acabou antes, então não vira ranking (`prova-online.ts:438`).
- **"Tempo esgotado"** não usa a cor de erro e não traz palavra de falta ou consequência (`Acompanhamento.tsx:12-17`).
- **Tela da sala.** O acompanhamento nunca é lido na aba Hoje, que a professora projeta, e há teste para isso (`Acompanhamento.test.tsx:234-239`).
- **Releitura.** A lista é relida a cada 15 s só com a prova aberta e a janela à vista. Prova encerrada não é relida, e o acompanhamento fica preso àquela avaliação.
- **Saída da aba.** Aparece só no lote, para o professor da turma, presa àquela avaliação e sempre com o aviso fixo "Sozinho, não indica cola.". Ela não impede a aprovação (`e2e/professor-prova.spec.ts:386-421`).

Discursiva e redação (D46, D55): nada nesta tarefa. Nenhum campo, tela ou texto sugere nota.

Medir o professor (D45, item 8): nada nesta tarefa.

Bloqueantes: nenhum.

Recomendações:
1. Na aplicação de uma segunda chamada, o acompanhamento lista a turma inteira. Quem não foi convocado aparece como "Não começou", com "Estender". Isso pode sugerir à professora que esses alunos estão devendo a prova. A correção já está registrada no `TODO.md` (11.0) e é da API: filtrar a leitura pelos convocados. Ela deve entrar antes de a segunda chamada ir para o piloto.
2. A tentativa que a professora cortou antes do limite aparece como "Enviou". Isso apaga um ato humano da leitura, que fica menos fiel ao que aconteceu. Uma situação própria no contrato resolveria. Já está anotado no `TODO.md` e no `cenarios.md`, e vale levar ao Arquiteto junto da recomendação 1.
3. O aviso do diálogo de estender, "A extensão fica registrada com o seu nome", só é verdade porque quem estendeu e quando ficam gravados na linha da extensão (`apps/api/src/atividade/atividade-aplicada/extensao.service.ts:26-27`). A auditoria registra só o escopo. Um teste de API que prove o autor gravado deixaria a promessa da tela coberta por teste, caso ainda não exista um no `prova-online.int.test.ts`.

As fotos da tela não vieram, então a revisão foi só pelo código. Nenhum achado depende de foto.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-28 03:34:01 · `tasks/prd-avaliacao-e-correcao/11_task.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado. A tarefa não toca a tela do aluno (12.0), e o aluno entra pela API no e2e.

**Aderência à Tech Spec:** a tarefa registra três divergências. As duas que a Tech Spec descreve (os homônimos como "(1 de 2)" e a segunda chamada só para quem não começou) estão na `techspec.md` §9 e no `cenarios.md` §4. A terceira, aplicar pela API no e2e, está no `cenarios.md` §4b, que é onde o e2e é descrito; a Tech Spec não cita `professor-prova.spec.ts`. O texto da segunda chamada, porém, contradiz a §5.9 (bloqueante abaixo).

**Portão local:** carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

**Bloqueantes:**

1. `apps/web/src/areas/professor/atividades/SegundaChamada.tsx:25` e o docblock em `:229-230`. A tela diz à professora uma regra que a Tech Spec nega.
   - O texto mostrado é: "Quem começou e não enviou fica com o que respondeu, e não se convoca de novo."
   - O docblock diz: "os que começaram e não enviaram foram com o que tinham salvo, e a API não os convoca".
   - A `techspec.md` §5.5 diz o contrário: "A cortada segue convocável na segunda chamada". A §5.9 confirma: "quem a professora cortou antes do limite (sem `enviada_em`) continuam convocáveis".
   - A própria divergência da tarefa diz que a API continua aceitando a cortada e que a tela só oferece o subconjunto seguro. Ou seja, a tela não oferece a cortada por limitação do contrato (`extensao.service.ts:18` devolve a cortada como `enviou`), e não porque a regra proíba.
   - Consequência: a professora lê que a aluna cortada não pode fazer a segunda chamada e desiste, embora o RF10 ("reabre a prova para quem não a enviou") e a API permitam.
   - **Correção exigida:**
     - Reescrever `TEXTO_DE_NINGUEM_PARA_CONVOCAR` sem afirmar que quem começou não se convoca. Basta dizer o que a tela faz, por exemplo: "Todos os alunos da turma já começaram ou enviaram a prova: esta tela oferece só quem não começou."
     - Corrigir o docblock de `SegundaChamada` para repetir a divergência registrada: a API aceita a cortada, e a tela oferece só `nao_comecou` porque o acompanhamento não a distingue.
     - Ajustar o caso `SegundaChamada.test.tsx › quando ninguém é convocável`, se ele conferir o texto literal (hoje usa a constante).

**Recomendações:**

- `tasks/prd-avaliacao-e-correcao/tasks.md`: a 11.0 está marcada `[x]`, mas as subtarefas 11.1 e 11.2 seguem `[ ]`. Marcar as duas.
- `SegundaChamada.tsx:168`: quem já enviou uma segunda chamada anterior da mesma original aparece como `nao_comecou` no acompanhamento da original e é oferecido. A API recusa com `ENTRADA_INVALIDA`, e o texto cobre ("já enviou a prova"), mas a tela oferece quem não pode ser convocado. Esse caso cabe junto do item que a tarefa já abriu no `TODO.md` sobre o contrato do acompanhamento.
- `Acompanhamento.tsx:20`: `PODE_ESTENDER.tempo_esgotado = true` só é correto porque, com a prova aberta, a vencida ainda não tem `enviada_em` (o encerramento é que grava). Vale uma linha no comentário do mapa dizendo isso; hoje ele diz só "quem não enviou", e "Tempo esgotado" conta como enviada em toda leitura (§5.5).
- `api/acompanhamento.ts`: a função `openSegundaChamada` mistura inglês e português no nome, ao lado de `estenderTempo` e `guardarOAcompanhamento`. Ela segue a convenção da X8 (técnico em inglês, domínio em português), mas no mesmo arquivo destoa.

Arquivos citados:
- apps/web/src/areas/professor/atividades/SegundaChamada.tsx
- apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx
- apps/web/src/areas/professor/atividades/Acompanhamento.tsx
- apps/web/src/areas/professor/atividades/api/acompanhamento.ts
- apps/api/src/atividade/atividade-aplicada/extensao.service.ts
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/tasks.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 03:34:14 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

**Por que passa:**
- **Rate limit:** a tarefa não cria rota. O `GET …/acompanhamento`, o `POST …/extensoes` e o `POST …/segunda-chamada` são da 5.0 e da 9.0 e passam pelo guarda por usuário de sempre.
- **Releitura:** o painel relê só com a prova aberta e a aba à vista (`refetchIntervalInBackground: false`). Numa manhã com 60 turmas em prova, isso dá uns 4 pedidos por segundo, perto de 5% dos ~80 por segundo do caminho quente da prova (techspec §7c). Cada leitura é uma consulta só, e o `EXPLAIN` dela foi conferido na 5.0. A leitura do encerramento só sai com o diálogo aberto.
- **Corridas:**
  - **Estender:** o clique duplo manda um pedido só (a trava `decidindo` em `Estender.tsx`). O reenvio do mesmo pedido leva a mesma `chave`, e a API devolve o que já gravou.
  - **Segunda chamada:** a mesma trava no cliente, e no banco o índice único parcial `atividade_aplicada_segunda_chamada_aberta_unica` (`packages/core/src/db/schema/atividade-aplicada.ts:82`) faz o segundo pedido voltar `CONFLITO`, com texto claro na tela.
  - **Leitura atrasada:** ela não cobre o limite novo, porque a tela cancela a leitura no ar antes de gravar a resposta da extensão (`cancelQueries` antes de `setQueryData`, em `api/acompanhamento.ts`).
- **Estado e escala:** não há estado no servidor nem migration, e nada demorado roda dentro de um pedido. Nenhum teste chama provedor pago (sem IA, e o e2e usa só a API e o banco).

**Recomendações:**
1. O cenário `infra/k6/prova-online.js` não inclui a professora relendo o acompanhamento a cada 15 s. Vale pôr um professor por turma nesse ritmo e conferir que o p95 do PUT de resposta continua abaixo de 500 ms. Não bloqueia: a consulta já foi dimensionada e conferida na 5.0, e a carga a mais é pequena.
2. Se o pedido de estender passa do prazo depois de já gravado e a professora fecha e reabre o diálogo, a reabertura gera chave nova e pode somar uma segunda extensão. O resultado aparece na releitura seguinte, em até 15 s. Vale mostrar no diálogo o "termina às" relido na abertura, para ela ver que a extensão já entrou antes de confirmar de novo.
3. Na falha, a releitura de 15 s soma as novas tentativas do `shouldRetry` (`apps/web/src/api/query-client.ts`). Vale conferir se elas respeitam o `Retry-After` do 503, que a correção `2026-11-27-pool-503` passou a mandar.

Arquivos auditados:
- `apps/web/src/areas/professor/atividades/Acompanhamento.tsx`
- `apps/web/src/areas/professor/atividades/Estender.tsx`
- `apps/web/src/areas/professor/atividades/SegundaChamada.tsx`
- `apps/web/src/areas/professor/atividades/api/acompanhamento.ts`
- `apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.tsx`
- `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-28 03:36:54 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:**
  - acompanhar por aluno, com a situação em texto e o "termina às" no fuso da escola;
  - estender um aluno e a turma, com o efeito antes de confirmar;
  - abrir a segunda chamada com os convocados por nome, a janela, a duração e o tempo adicional;
  - encerrar com "N alunos ainda estão fazendo";
  - o e2e de ponta a ponta: acompanha, estende, encerra e aprova o lote com "Saiu da aba".
- **Bordas:**
  - dois alunos com o mesmo nome;
  - o computador em outro fuso;
  - a turma sem alunos;
  - o aluno que perdeu a prova (só quem não começou é convocado, e quem enviou ou esgotou o tempo fica fora);
  - 0 e 121 minutos, vazio e fração;
  - encerrar com 3, 1 e 0 fazendo;
  - a prova sem duração;
  - a prova encerrada com o diálogo de estender aberto;
  - a falha da releitura com o dado já na tela;
  - a resposta atrasada de uma leitura;
  - 360 px.
- **Permissão:**
  - a prova encerrada não oferece "Estender";
  - a aberta e a própria segunda chamada não oferecem "Segunda chamada";
  - a aba Hoje (tela da sala) nunca lê o acompanhamento.
- **Isolamento:** a tarefa não cria consulta. As rotas são da 5.0 e da 9.0, e o isolamento está provado em `extensao.int.test.ts` (casos das linhas 526 e 559).
- **Concorrência:**
  - dois cliques no mesmo `act` em "Estender o tempo" e em "Abrir a segunda chamada";
  - o reenvio com a mesma `chave`, e chave nova para outros minutos, outro alvo ou outra abertura;
  - `cancelQueries` antes de `setQueryData`.

**Cobertos:** todos os cenários acima. Cada linha da tabela de testes do documento tem o seu teste, e todos os nomes citados existem. Não há `.skip`, `.only` nem teste comentado. A rede é falsa só na unidade, e o e2e roda contra a API e o banco reais. Os 6 arquivos de unidade passam (119 casos). O `--faltando` lista 33 itens, e todos têm motivo em prosa no documento. Quatro desses motivos não se sustentam, e são o bloqueante abaixo.

**Bloqueantes:**

1. **Quatro termos novos sem bloco, com um motivo que não os cobre.** Nenhum teste fica vermelho se o termo for removido.
   - **Onde:**
     - `apps/web/src/areas/professor/atividades/Acompanhamento.tsx:63`, o termo `acompanhamento.isPending`;
     - `apps/web/src/areas/professor/atividades/Acompanhamento.tsx:64`, o termo `acompanhamento.isError`;
     - `apps/web/src/areas/professor/atividades/SegundaChamada.tsx:122`, o termo `acompanhamento.isPending`;
     - `apps/web/src/areas/professor/atividades/SegundaChamada.tsx:123`, o termo `acompanhamento.isError`.
   - **O que o motivo diz:** "os blocos que tiram a linha" e "os que trocam o termo (`!lido`, `lida`…)" cobririam esses termos. Não cobrem: tirar a linha prova que o carregando aparece, e não que ele some; trocar `!lido` prova o outro termo.
   - **Por que sobrevivem:**
     - Sem `isPending`, "Carregando o acompanhamento da prova…" e "Carregando os alunos da turma…" ficam na tela junto com a lista. Nenhum caso confere que o texto some quando o dado chega.
     - Sem `isError`, o `ErrorState` aparece durante o carregamento, com `role=alert` e "Tentar de novo". Ele é renderizado sem condição: `apps/web/src/components/states/ErrorState.tsx:23-35`.
     - Os casos `carregando, a seção diz que lê` e `enquanto lê os alunos` não conferem a ausência do alerta nem do "Tentar de novo".
   - **Por que importa:** são dois dos quatro estados da regra 50, item 5, sem prova.
   - **Correção exigida:**
     - acrescentar `queryByText('Carregando…')` nulo nos casos com dado: em `a situação de cada aluno é texto` e em `só quem não começou é convocável`;
     - acrescentar `queryByRole('alert')` nulo e `queryByRole('button', { name: 'Tentar de novo' })` nulo nos dois casos de carregando;
     - declarar os quatro blocos: `-{acompanhamento.isPending && <LoadingState …/>}` → `+{<LoadingState …/>}`, e `-{acompanhamento.isError && !lido && …}` → `+{!lido && …}`, e os equivalentes em `SegundaChamada`.

**Recomendações:**
- **O "+50%" do e2e não é conferido.** O caso `e2e/professor-prova.spec.ts:72` diz "a Ana com +50%" no nome, mas só lê o horário por regex (`:81`). Nada mostra que o limite é o de 60 min, e não o de 40. Confira o `termina` contra a hora de começar mais 60 min, com tolerância de 1 min, ou tire o "+50%" do nome.
- **Espera fixa no recomeço.** Em `e2e/professor-prova.spec.ts:207`, o `waitForTimeout(500)` vem antes de uma asserção negativa. Prefira esperar uma promessa que o handler da rota resolve depois do `fulfill`.
- **O limite de cima da releitura se prova pela constante.** Em `Acompanhamento.test.tsx:178` e `:190`, o que mata a mutação de 16 s é o `expect(INTERVALO_DO_ACOMPANHAMENTO_MS).toBe(15_000)`, e não o comportamento: o `waitFor` com o relógio falso avança até uns 16,5 s. Troque o `waitFor` por uma asserção direta depois de `passar(1_000)`.
- **"Estender" no `tempo_esgotado` sem prova do lado da API.** A tela oferece o botão a quem esgotou o tempo (`Acompanhamento.tsx:20`), e o efeito diz "ganha N minutos a mais na prova". Nenhum teste de `extensao.int.test.ts` mostra que estender reabre a tentativa vencida sem envio. Fica para o `TODO.md`: um caso de integração na API.
- **Uma condição de atributo sem caso próprio.** O `semConvocados` em `aria-describedby` (`SegundaChamada.tsx:64`) não tem caso; vale conferir o atributo no caso `sem convocado, sem janela`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 03:55:35 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Os textos da segunda chamada não contradizem mais as §5.5 e §5.9.

Portão local: carimbo válido. Ele cobre typecheck, lint, segredo, dependências, unidade e alvo do código atual.

Bloqueantes: nenhum

A correção exigida na rodada anterior foi feita:
- **O texto da tela:** `TEXTO_DE_NINGUEM_PARA_CONVOCAR` (`apps/web/src/areas/professor/atividades/SegundaChamada.tsx:25`) agora diz só o que a tela oferece: "Todos os alunos da turma já começaram ou enviaram a prova: esta tela oferece só quem não começou." A tela não afirma mais que quem começou não pode ser convocado.
- **O docblock:** o de `SegundaChamada` (`SegundaChamada.tsx:229-231`) agora repete a divergência registrada. A API aceita a aluna cortada, conforme as §5.5 e §5.9, mas o acompanhamento a devolve como `enviou`, e por isso a tela oferece só `nao_comecou`.
- **O teste:** o caso `SegundaChamada.test.tsx › quando ninguém é convocável` (`:291-295`) usa a constante e não precisou mudar. Não sobrou nenhuma ocorrência de "não se convoca" nem de "não os convoca" na tela, nos testes, no `docs/interface.md`, na `techspec.md` ou no `cenarios.md`.

O resto do diff confere:
- As duas recomendações da rodada anterior foram aplicadas: 11.1 e 11.2 estão marcadas em `tasks.md`, e a linha no comentário de `PODE_ESTENDER` (`Acompanhamento.tsx:19-22`) está no lugar e de acordo com a §5.5.
- As outras recomendações estão no `TODO.md`, uma por linha, e cada uma tem destino na tabela "Recomendações sem aplicar".
- A orientação nova da turma vazia usa nomes que existem na tela: "Convidar alunos" está em `AcessoDaTurma.tsx:96` e "pedidos de nome" está na aba Alunos.
- Os blocos de mutação novos correspondem às linhas que eles mudam. O motivo do `aria-describedby` sem bloco saiu do documento porque agora há bloco e caso para ele.

Recomendações:
- **Releitura aos 15 s:** em `Acompanhamento.test.tsx:192-193`, o caso que trocou o `waitFor` por `expect(leituras(rede)).toBe(2)` logo depois de `passar(1_000)` depende de o pedido sair dentro do `act` do avanço do relógio. Hoje passa no carimbo. Se ficar instável, o `waitFor` com o avanço exato de 1 s é o meio-termo.
- **Fuso fixo no e2e:** em `e2e/professor-prova.spec.ts:185`, `minutosDoDiaNaEscola` fixa `America/Sao_Paulo` no código. Se a escola do `montarEscola` tiver o fuso configurável, vale ler o fuso dela em vez de fixá-lo.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-28 03:55:47 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff entre as árvores `c5eac55e` e `38c5ac7f` e o que ele afeta. A diferença da árvore de trabalho para `38c5ac7f` são só os arquivos novos, ainda não rastreados (aparecem como removidos). Os rastreados batem.

Campos pessoais tocados: nenhum campo novo. O diff só muda texto de tela e testes:
- o estado vazio do Acompanhamento agora orienta a convidar alunos;
- o texto de "ninguém para convocar" da SegundaChamada ficou mais curto;
- o `aria-describedby` do grupo passou a ter teste;
- o e2e confere o limite da Ana contra o começo mais 60 min, no fuso da escola;
- o e2e de recomeço não espera mais por relógio.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. O diff não toca API, rota, repository nem contrato. O `alunoId` fictício `0197a1c0-…-ffff` ("Fantasma Antigo") é injetado pelo `page.route`, só no navegador do teste.

Logs: limpos. Não há `console.` nem `logger.` em `Acompanhamento.tsx`, `SegundaChamada.tsx` nem `e2e/professor-prova.spec.ts`.

Auditoria: presente. Nenhuma ação nova que a exija.

Envio externo: nenhum.

Seed/fixture: sintético. "Ana Souza", "Bia Lima" e "Fantasma Antigo" são nomes inventados, e o UUID injetado é fictício.

Bloqueantes: nenhum.

Recomendações:
- `TODO.md`: o item "Homônimos no acompanhamento" está bem enquadrado. Quando ele virar tarefa, o campo que distingue os dois alunos não pode ser matrícula, sobrenome completo nem algo derivado deles (regra 20, item 1), e precisa entrar na tabela de dados de `docs/lgpd.md` na mesma tarefa.
- `apps/web/src/areas/professor/atividades/SegundaChamada.tsx`: o comentário novo aceita que a tela não oferece a prova cortada pela professora antes do limite, porque o acompanhamento a mostra como `enviou`. Para privacidade, é o lado seguro, porque nada é exposto a mais. A correção da situação está no TODO.md, como dívida de contrato da API.

Pergunta de fechamento: o diff não muda o que o sistema guarda sobre um aluno nem para onde isso vai. A resposta da 1ª rodada continua valendo.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-28 03:55:50 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO
Tela vista: não. A vitrine não tem prova avaliativa com janela, e a aba Atividades da turma saiu em "Carregando a aba…". Revisei o diff da rodada 2 pelo código e pelos testes. A revisão de tela fica para o Validador.
Estados: ok. O carregando e o vazio têm texto próprio. O erro só aparece sem leitura anterior, com "Tentar de novo". Os testes novos provam que carregar não mostra alerta nem "Tentar de novo". Provam também que o "Carregando…" sai quando o dado chega.
Acessibilidade: ok. O grupo "Quem faz a segunda chamada" só aponta `aria-describedby` para o aviso quando o aviso está na tela. Esse caso tem teste e bloco de mutação. O estado vazio é um parágrafo comum.
Chromebook fraco: sem mudança nesta rodada. A releitura de 15 s continua só com a janela à vista. O e2e deixou de usar `waitForTimeout(500)` e passou a esperar a resposta atrasada. Ficou mais estável em máquina lenta.
Celular: sem mudança de layout nesta rodada. Os casos de 360 px e de 44 px continuam no e2e `professor-prova.spec.ts`, nos dois projetos, e não os reexecutei.
Ação oficial protegida: sim. "Estender" e "Segunda chamada" só abrem com confirmação que diz o efeito e quem recebe. A confirmação não nomeia quem tem tempo adicional, só diz quantos (D35).

Correções exigidas: nenhuma tinha sido pedida na rodada 1.

Recomendação aplicada, conferida:
- O estado vazio do Acompanhar agora diz: "Na aba Alunos, use “Convidar alunos” e aprove os pedidos de nome: quem entrar aparece aqui."
- O botão "Convidar alunos" existe em `apps/web/src/areas/professor/turmas/acesso/AcessoDaTurma.tsx:96`, na aba Alunos (`AlunosDaTurma`).
- A aba Alunos também tem a lista de pedidos de nome (`ListaDePedidos`, `AlunosDaTurma.tsx:14`).
- O que o texto manda fazer existe, e a frase fica em português corrente, sem termo técnico.
- O texto novo de `TEXTO_DE_NINGUEM_PARA_CONVOCAR` ("esta tela oferece só quem não começou") é claro e coerente com o que a tela faz.

Bloqueantes: nenhum.

Recomendações:
- O estado vazio do Acompanhar ainda diz "Esta turma ainda não tem alunos", mas a segunda chamada também pode mostrar a turma inteira como "Não começou". Isso já está no `TODO.md`, no item da API do acompanhamento da segunda chamada.
- Os itens "mostrando a última leitura" e "Conferindo quem ainda faz…" melhoram o estado de erro e o de carregando. Estão no `TODO.md`, e vale priorizá-los antes do piloto, porque a escola tem rede fraca.
- A tela do Acompanhar e os diálogos de Estender e de Segunda chamada ainda precisam ser vistos em foto, a 360 px e a 1366 px, na validação.

Arquivos principais:
- `apps/web/src/areas/professor/atividades/Acompanhamento.tsx` (linha 68)
- `apps/web/src/areas/professor/atividades/SegundaChamada.tsx` (linhas 25 e 64)

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-28 03:55:52 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff desta rodada não tem migration nem schema.

Queries verificadas: nenhuma nova. O diff não toca repository, service nem endpoint. As mudanças estão em:
- `apps/web/src/areas/professor/atividades/Acompanhamento.tsx`: um comentário e o texto da turma vazia.
- `apps/web/src/areas/professor/atividades/SegundaChamada.tsx`: um texto e um comentário.
- Os testes de unidade desses dois componentes.
- `e2e/professor-prova.spec.ts`: a conferência do limite da Ana e a espera da resposta atrasada sem relógio.
- `TODO.md`, `tasks.md` e `11_task.md`.

O arquivo `api/acompanhamento.ts` não mudou, então nenhum pedido passou a mandar `escolaId` no corpo ou na query. O id falso que o e2e injeta pelo `page.route` (`0197a1c0-…-ffff`) é UUID, e só existe para provar que a tela descarta a leitura atrasada.

Teste de isolamento: presente e efetivo. Esta rodada não muda nada que dependa dele, e ele continua como estava na 1ª rodada. A tarefa é só de tela e não cria escopo novo na API.

Bloqueantes: nenhum. A 1ª rodada não exigiu correções, então não havia nada a conferir.

Recomendações:
- Dois itens novos do `TODO.md` não são de isolamento entre escolas, mas são de autorização por objeto. Quando forem corrigidos na API, o filtro pelos convocados no acompanhamento da segunda chamada e a contagem da `participacao` precisam continuar saindo do contexto autenticado, e não de uma lista mandada pelo cliente. O primeiro trata o acompanhamento que conta a turma inteira. O segundo trata quem já enviou uma segunda chamada anterior e aparece como `nao_comecou`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-28 03:56:08 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova (só a tela do professor; nenhuma linha de API, fila, IA, migration ou deploy mudou nesta rodada)
Rate limit: ok (não muda nesta rodada; a tela só chama rotas que já existiam)
Fila e prioridade: ok (não se aplica ao diff)
Concorrência: protegida (a releitura e o encerramento não mudaram; a chave de idempotência do `Estender` continua uma por abertura do diálogo, como decidido na 5.0)
Índice e paginação: ok (nenhuma query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum código novo de servidor no caminho quente)
Bloqueantes: nenhum
Recomendações:
- Na 1ª rodada não exigi nenhuma correção. Minhas quatro recomendações agora estão no `TODO.md`, com destino na tabela "Recomendações sem aplicar" do `11_task.md`:
  - a professora relendo o acompanhamento a cada 15 s no `infra/k6/prova-online.js`;
  - a chave nova a cada reabertura do diálogo de estender;
  - o `Retry-After` do `shouldRetry` nas releituras;
  - o painel seguindo com a leitura anterior sem aviso quando a releitura falha.
  
  Antes da manhã de segunda das dez escolas, o que mais pesa é o cenário k6: sessenta professoras relendo a cada 15 s somam uns 4 pedidos por segundo constantes na API durante a prova, e isso ainda não está medido.
- `apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx`: a asserção `INTERVALO_DO_ACOMPANHAMENTO_MS === 15_000` saiu. O caso do relógio falso ainda prova o intervalo: aos 14 s não há leitura nova e aos 15 s há exatamente uma. Se alguém baixar o intervalo, o teste fica vermelho, então não é bloqueante.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-28 03:56:10 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

O diff desde a 1ª rodada (árvore `c5eac55e` até `38c5ac7f`) só mexe em textos e testes da tela do professor, em asserções do e2e, no `TODO.md` e nos registros da tarefa. Não toca em `Nota`, correção, saída de IA, Tutor, autonomia de agente, auditoria nem em indicador de professor. A 1ª rodada não exigiu correção; as recomendações dela foram para o `TODO.md`, uma por linha (linhas 9 a 17 do patch), como pedido.

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff não toca em API, schema, job, seed, importação nem webhook. Todos com autor humano? sim, e nada mudou desde a rodada aprovada.
Decisão autônoma sobre aluno: ausente. O que mudou na `SegundaChamada.tsx` é só texto (`TEXTO_DE_NINGUEM_PARA_CONVOCAR`, linha 25) e um comentário. Quem é convocado continua sendo escolha da professora, nome por nome.
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi afetado.
Supervisão do tutor: ok. O Tutor não aparece no diff.
Autonomia declarada e visível: sim, e nada mudou nisso.

O que conferi no que mudou:
- **Turma sem alunos** (`apps/web/src/areas/professor/atividades/Acompanhamento.tsx:68`): o texto novo só orienta a convidar alunos e aprovar os pedidos de nome. Não traz nota, conceito nem inferência sobre o aluno.
- **Quem pode ganhar mais tempo** (`Acompanhamento.tsx:19-23`): só o comentário mudou. A extensão continua sendo ato da professora, sem nada aplicado sozinho.
- **Supervisão não é vigilância** (item 7): o e2e mantém a asserção de que o acompanhamento não mostra saída da aba, percentual nem tempo parado (`e2e/professor-prova.spec.ts`, `not.toContainText(/saiu|saída|%|parado|falt/i)`). O fato da D70 segue só no lote da prova, como antes.
- **Tempo adicional sem expor a necessidade** (D35): o título do teste trocou "+50%" por "tempo adicional". A asserção nova confere o horário de fim contra o começo mais 60 minutos, sem pôr o percentual na tela. A confirmação da segunda chamada continua dizendo quantos alunos têm tempo adicional, e não quais.
- **Discursiva e redação** (D55): nenhum campo, tela ou texto que sugira nota.
- **Medir o professor** (D45 e D64): nenhuma métrica, ranking ou leitura pela coordenação.

Bloqueantes: nenhum.

Recomendações:
- Fica valendo a do `TODO.md` (linha 11 do patch): um teste de API que prove que a extensão grava o nome de quem estendeu. É ele que sustenta o aviso "A extensão fica registrada com o seu nome". Não bloqueia porque a tarefa não toca a API, mas essa garantia de autoria e auditoria segue sem prova automatizada até lá.

Fotos da tela: indisponíveis, como o prompt registra. Por isso não há achado de foto, e a revisão seguiu pelo código.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-28 03:57:00 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: REPROVADO

Cenários exigidos (rodada nova, sobre o diff c5eac55e..38c5ac7f): as quatro mutações pedidas na 1ª rodada (`isPending` e `isError` em `Acompanhamento` e em `SegundaChamada`), com as asserções que as fazem cair. Também conferi as recomendações aplicadas: o tempo adicional no e2e, o recomeço sem espera fixa, a releitura aos 15 s pelo comportamento e o `aria-describedby` de `semConvocados`. E conferi o motivo reescrito na seção "Mutações".

Cobertos:
- **Correção 1, feita.** Os blocos e as asserções que os derrubam:
  - `Acompanhamento.tsx:66`: o bloco `isPending` cai em `a situação de cada aluno é texto`, que agora confere que "Carregando o acompanhamento da prova…" sumiu (`Acompanhamento.test.tsx:121`).
  - `Acompanhamento.tsx:67`: o bloco `isError` cai em `carregando, a seção diz que lê`, que confere a ausência de `alert` e de "Tentar de novo" (`:86-87`). O `ErrorState` traz `role=alert` e o botão sem condição (`ErrorState.tsx:26,30`), então a mutação cai pelo motivo certo.
  - `SegundaChamada.tsx:122`: o bloco cai em `só quem não começou é convocável`, que confere a ausência do "Carregando os alunos da turma…" (`SegundaChamada.test.tsx:108`).
  - `SegundaChamada.tsx:123`: o bloco cai em `enquanto lê os alunos`. A asserção `queryAllByRole('alert')…toEqual([''])` deixa de valer com um segundo alerta com texto, e "Tentar de novo" é conferido como nulo (`:263-265`).
- **`aria-describedby`, coberto.** Ganhou bloco (`tentou && semConvocados` → `tentou`), e `sem convocado, sem janela` confere o atributo nulo depois de escolher a Bia (`:191`). Cai.
- **E2e do tempo adicional, coberto.** O limite da Ana é conferido contra o começo mais 60 min, com 1 min de folga e no fuso da escola (`e2e/professor-prova.spec.ts:220-222`). Um limite de 40 min ficaria 20 min fora e o teste cairia.
- **Releitura aos 15 s.** O `waitFor` saiu, e agora é `expect(leituras).toBe(2)` logo depois de 15 s no relógio falso. O limite de cima é provado pelo comportamento.
- `Acompanhamento.test.tsx` e `SegundaChamada.test.tsx` rodados: 27 de 27 verdes.

Bloqueantes:
1. **O termo `!lida` em `SegundaChamada.tsx:123` não tem bloco, e o motivo novo diz que tem.**
   - **O que está errado:** `11_task.md:108` diz: "`!lida` na leitura do diálogo da segunda chamada … tem bloco (`{!lida && <ErrorState …>}`)". Esse bloco (`11_task.md:862-864`) tira o `isError` e deixa o `!lida`, então prova o `isError`, não o `!lida`. A mutação que tira o `!lida` (`{acompanhamento.isError && <ErrorState …/>}`) não aparece em bloco nenhum. Nenhum caso tem a leitura com dados e com erro ao mesmo tempo.
   - **O motivo antigo também não vale:** ele dizia que "o diálogo não relê sozinho". Só que o diálogo usa `useQuery(acompanhamentoQueryOptions(aplicada.id))` (`SegundaChamada.tsx:157`), com o `staleTime` de 30 s (`apps/web/src/api/query-client.ts:28`) e o `refetchOnWindowFocus` padrão do TanStack ligado. A chave também fica debaixo de `ATIVIDADES_QUERY_KEY`, e uma releitura da lista relê o acompanhamento (`api/acompanhamento.ts:24-25`). Na prática: a professora abre o diálogo, troca de aba por mais de 30 s e volta. A releitura falha e o diálogo fica com dados e com erro. Sem o `!lida`, o `ErrorState` aparece em cima da lista dos convocáveis.
   - **Correção exigida:**
     - Um caso em `SegundaChamada.test.tsx`: a lista carrega, a rede passa a responder erro, e a releitura é forçada (`focusManager` com o relógio além de 30 s, ou `refetchQueries` na chave). O caso confere que a lista segue na tela, sem alerta com texto e sem "Tentar de novo".
     - O bloco `-{acompanhamento.isError && !lida && <ErrorState …/>}` → `+{acompanhamento.isError && <ErrorState …/>}`, com esse caso.
     - Corrigir a frase de `11_task.md:108`.

Recomendações:
- **Recomeço no e2e (`e2e/professor-prova.spec.ts:245-248`).** A espera agora é `chegou` (o `fulfill` terminou no Playwright) mais dois `requestAnimationFrame`. Esse sinal não garante que a página já processou a resposta. Se ela ainda não chegou à tela, `not.toContainText('Fantasma Antigo')` e `toHaveCount(2)` passam na hora e o teste fica verde sem provar nada. A falha é para o lado do falso verde, não do vermelho instável, por isso não bloqueia. Mais firme: esperar o `requestfinished` dessa leitura (`page.waitForEvent('requestfinished', …)`) antes dos quadros. A asserção sobre a tela também é mais forte que só a rede.
- Os itens novos do `TODO.md` (homônimos, segunda chamada anterior, autor da extensão, `tempo_esgotado` com a prova aberta, "mostrando a última leitura", k6, chave por abertura, `Retry-After`) têm destino registrado na tabela "Recomendações sem aplicar". Nada a acrescentar.

Arquivos citados:
- apps/web/src/areas/professor/atividades/SegundaChamada.tsx
- apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx
- tasks/prd-avaliacao-e-correcao/11_task.md
- e2e/professor-prova.spec.ts

## revisor-geral · 3ª rodada · APROVADO · 2026-11-28 04:25:05 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O código de produção não mudou desde a 2ª rodada. O patch só traz o teste, o e2e, o `TODO.md` e o documento da tarefa.

Portão local: carimbo válido. A suíte inclui typecheck, lint, segredo, dependências, unidade e alvo.

Bloqueantes: nenhum.

O que conferi no diff desta rodada:
- **Bloco de mutação novo.** Ele bate com a linha real de produção, `apps/web/src/areas/professor/atividades/SegundaChamada.tsx:123`. Tirar o `!lida` faz o `ErrorState` aparecer por cima da lista na releitura que falha. É isso que o caso novo pega, porque exige que não haja "Tentar de novo" e que os alertas sejam só o vazio `['']`.
- **Mesmo bloco, no texto da seção "Mutações" do `11_task.md`.** O texto foi ajustado e a contagem passou de 106 para 107.
- **`e2e/professor-prova.spec.ts`.** O sinal `entregue()`, que dependia de a rota entregar a resposta, deu lugar a uma corrida entre `requestfinished` e `requestfailed`. Isso cobre o caso em que a troca de prova cancela a leitura da primeira. A asserção continua sem espera de relógio e sem `waitForTimeout`.
- **`TODO.md`.** O único item novo é o do fuso, que vem da recomendação do `revisor-geral` da 2ª rodada.

Recomendações:
- O caso novo em `apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx` diz no comentário que o `staleTime` é de 30 s. Esse valor vem da configuração geral do `QueryClient`, não de `acompanhamentoQueryOptions`. Se esse padrão mudar, o avanço de 31 s deixa de disparar a releitura, e o caso passa a dar verde pelo motivo errado, sem que haja segunda leitura. O `waitFor` das duas leituras já segura isso hoje. Se quiser deixar a dependência explícita, prenda o `staleTime` nas opções da consulta.
- A asserção `toEqual([''])` depende de existir exatamente uma região de alerta vazia no diálogo. Ela quebra se essa região mudar, mesmo sem mudança na regra. Conferir só que nenhum alerta tem texto (`every(texto => texto === '')`) deixaria o caso menos frágil.

## test-engineer · 3ª rodada · APROVADO · 2026-11-28 04:25:48 · `tasks/prd-avaliacao-e-correcao/11_task.md`

VEREDITO: APROVADO

Cenários exigidos: a correção da 2ª rodada. Um caso em que a releitura do diálogo da segunda chamada falha depois que a lista já carregou; o bloco que tira o `!lida` de `SegundaChamada.tsx:123`, apontando para esse caso; e a frase de `11_task.md:108` corrigida. Também conferi a recomendação aplicada no e2e: a espera do recomeço agora é por `requestfinished` ou `requestfailed`.

Cobertos:
- **O caso novo está no teste.** Em `SegundaChamada.test.tsx`, o caso "a releitura que falha com a lista já na tela deixa a lista, sem alerta com texto e sem "Tentar de novo"" segue o roteiro pedido:
  - Uma única função de resposta troca de `leitura(TURMA)` para `FALHA` (429 `LIMITE_EXCEDIDO`). O `shouldRetry` não repete esse erro (`apps/web/src/api/query-client.ts:15-20`), então a releitura já sai com erro, com os dados guardados.
  - O relógio falso entra antes de montar a tela. O teste tira o foco, avança 31 s e devolve o foco, e isso dispara o `refetchOnWindowFocus` da consulta vencida.
  - Ele espera a segunda leitura sair e confere três coisas: a lista segue na tela, o único alerta do diálogo é o vazio do `ConfirmDialog`, e não há botão "Tentar de novo".
  - Se o `!lida` sair, o `ErrorState` aparece com texto e com o botão (`ErrorState.tsx`), e as duas últimas asserções caem. O vermelho vem do motivo certo, não de exceção.
  - Rodei o arquivo: 15 de 15 passam.
- **O bloco novo está na seção "Mutações".** `-{acompanhamento.isError && !lida && <ErrorState …/>}` → `+{acompanhamento.isError && <ErrorState …/>}`, apontando para esse caso. A linha `-` bate letra por letra com `SegundaChamada.tsx:123` na árvore. O bloco antigo, `{!lida && <ErrorState …>}`, continua lá e prova o `isError`. A contagem passou de 106 para 107.
- **A frase de `11_task.md:108` foi corrigida.** Agora atribui o `!lida` ao bloco novo e ao caso novo, e o bloco antigo ao `isError`.
- **O `--faltando` não tem item novo.** As linhas de `SegundaChamada.tsx` que ele lista são só os elementos depois do `&&` e o termo `(`, que já têm motivo escrito.
- **O e2e foi trocado como recomendado.** Em `e2e/professor-prova.spec.ts:221-232`, a espera pelo fim da leitura da primeira prova (o `Promise.race` de `requestfinished` e `requestfailed`) é registrada antes de abrir o painel, e os dois `requestAnimationFrame` só vêm depois dela. Não há mais sinal resolvido de dentro da rota.
- **Item novo no `TODO.md`.** O fuso fixo do e2e, vindo do `revisor-geral` da 2ª rodada, está registrado.

Bloqueantes: nenhum.

Recomendações:
- `e2e/professor-prova.spec.ts:221-232`: a consulta passa o `signal` adiante (`api/acompanhamento.ts:30`) e tem `gcTime: 0`. Por isso, ao trocar de prova, o TanStack provavelmente cancela a leitura da primeira antes do `liberar()`. Nesse caminho, o `requestfailed` vence a corrida e a resposta atrasada nunca chega à página. O teste segue útil: se a chave perder o id, a leitura não é cancelada e o "Fantasma Antigo" aparece. Mas ele não diz qual dos dois caminhos aconteceu. Gravar qual evento venceu e escrevê-lo no comentário deixaria claro o que o caso prova.

Arquivos:
- apps/web/src/areas/professor/atividades/SegundaChamada.test.tsx
- apps/web/src/areas/professor/atividades/SegundaChamada.tsx
- tasks/prd-avaliacao-e-correcao/11_task.md
- e2e/professor-prova.spec.ts
