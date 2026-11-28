# Achados das revisões — `tasks/prd-avaliacao-e-correcao/12_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-28 07:54:40 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela, migration ou repository nesta tarefa. `git status` não mostra nenhuma mudança em `apps/api` nem em `packages`.
Queries verificadas: a tarefa não cria query no servidor. No cliente, conferi as chamadas que a tela faz:
- `GET /v1/atividades-aplicadas/:id/prova`, `GET …/tempo`, `POST …/comecar`, `POST …/saidas-da-aba` e o `PUT …/respostas/:n`, que já existiam. Nenhuma manda `escolaId` ou `alunoId` no corpo ou na query: `registrarSaidaDaAba` manda só `{ chave }`, e `comecar` manda `{}`.
- A rota nova `/aluno/prova/:id` exige UUID antes de chamar a API (`apps/web/src/areas/aluno/routes.tsx:57`).
- "Não disponível" mostra o mesmo texto para id que não existe e para id de outra turma ou escola (`apps/web/src/areas/aluno/ProvaEmFoco.tsx:311-315`, `apps/web/src/areas/aluno/AntesDeComecar.tsx:108-112`).
- A fila de saídas (`apps/web/src/areas/aluno/fila-de-saidas.ts`) e a de respostas param e se esvaziam em `aoTrocarDeSessao`. Assim, nada da sessão anterior sai com o token seguinte.
Teste de isolamento: presente e efetivo. Os testes de servidor da 3.0 e da 4.0 cobrem os endpoints que a tela usa:
- `apps/api/src/atividade/prova-online.int.test.ts:156`
- `apps/api/src/atividade/prova-online-aluno.int.test.ts:480`
- `apps/api/src/atividade/saida-da-aba.int.test.ts:394`

Nos três, aluno de outra escola recebe `NAO_ENCONTRADO`. Do lado da tela, a troca de sessão no mesmo navegador tem caso que quebra se a fila sobreviver à troca (`apps/web/src/areas/aluno/ProvaEmFoco.test.tsx:863`).
Bloqueantes: nenhum
Recomendações:
- Não achei teste de outra escola só para `GET …/tempo`. `apps/api/test/atividade.fixture.ts` chama esse endpoint, mas nenhum caso de outra escola casa com ele no grep. Se a 4.0 não o cobre em outro arquivo, vale abrir um caso "aluno de outra escola recebe `NAO_ENCONTRADO` no tempo" na tarefa de servidor que mexer nele de novo. Não bloqueia: esta tarefa não altera o endpoint.
- A lista de Tarefas lê as respostas pendentes em `apps/web/src/areas/aluno/fila-de-respostas.ts:484` pelo `atividadeAplicadaId`, sem conferir o dono da sessão. Hoje está certo porque `aoTrocarDeSessao` limpa as filas. Um comentário nessa função dizendo que depende dessa limpeza ajudaria quem mexer nela depois.

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-28 07:55:20 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: REPROVADO

Campos pessoais tocados: nenhum campo novo. A tela lê o que o próprio aluno já alcança: `titulo`, `janela` e `duracaoMin` antes de começar; depois, as questões na ordem dele, `ordemDasAlternativas`, as respostas dele, e `limiteEm`, `agora` e `envio` do tempo. A duração mostrada já inclui o tempo adicional e não diz que há adicional (`provaAntesDeComecarResponseSchema` e `AntesDeComecar.tsx:82`). A adaptação não fica exposta. A saída da aba leva só a `chave` (uuid v4, sem horário) e o id da aplicação.

Fora da tabela de dados do docs/lgpd.md: nada. A tarefa não cria campo, tabela nem migration.

Autorização por objeto: ok. A tarefa não cria rota de API. A tela não manda `alunoId`, só ids da aplicação (o servidor tira o aluno do token). A rota `/aluno/prova/:id` passa por `UUID.test` antes da tela. O 404 vira "Esta prova não está disponível… pode ser de outra turma, ou o endereço está errado", o mesmo texto para id inexistente e id alheio. O que fica no `history.state` (`voltouDaProva`) é só o UUID da aplicação.

Logs: limpos. Nenhum `console` nem `logger` nos arquivos novos ou alterados.

Auditoria: não se aplica. São leituras e escritas do próprio aluno, nenhuma das ações que a regra 20, item 10, exige auditar.

Envio externo: nenhum. A tarefa não chama IA nem terceiro.

Seed/fixture: sintético. Os e2e usam nomes inventados ("Ana Souza"), e as fotos mostram "Colégio sintético da vitrine" e "Aluno Sintético Caio/Téo".

Fotos (`.processo/vitrine/aluno--aluno-atividades--{computador,celular}.png` e `vazia--…`): só tarefas e situação do próprio aluno. Nenhum dado de colega, nenhuma contagem de saídas, nenhuma matrícula na lista. Não há foto de "Antes de começar" nem da prova em foco; essas telas eu revisei pelo código.

Bloqueantes:
- **`apps/web/src/areas/aluno/fila-de-saidas.ts:147-150`: a fila de saídas presa à sessão não tem teste que a prove.** O código faz `aoTrocarDeSessao(() => { for (const fila of filas.values()) fila.stop(); filas.clear() })`, e a autoconferência (item 11) afirma a "fila presa à sessão (caso do recomeço)".
  - **O que acontece sem o gancho:** a saída da aba de um aluno A que ficou pendente (queda ou 503) sai com o token do aluno B. Isso acontece logo que a sessão de B abre (`aoAbrirSessao` → `tryAgora`, linha 151) ou quando a rede volta. No Chromebook do carrinho, com B da mesma turma e já na mesma prova, o servidor grava em B uma saída que B não fez, e o professor vê esse fato falso sobre um menor (D70).
  - **Por que hoje ninguém pega isso:** o caso do recomeço (`ProvaEmFoco.test.tsx:863`) responde 204 às saídas da primeira pessoa, então nenhuma saída fica pendente, e ele só conta os `PUT` de respostas. Os casos "parada…" de `fila-de-saidas.test.ts:206` e `:218` chamam `stop()` direto, sem passar pela troca de sessão. Nenhum bloco de mutação alcança as linhas 147-150. Apagar o gancho deixa tudo verde.
  - **Correção exigida, em três partes:**
    1. Estender o caso do recomeço, ou criar um caso novo, em que a saída da primeira pessoa fica pendente: `saidas-da-aba` rejeita com queda ou 503 depois de um `blur`/`visibilitychange`.
    2. No mesmo caso: `sair()`, abrir a sessão da segunda pessoa e disparar `online` com o sorteio em 0, e então exigir zero `POST …/saidas-da-aba` na rede da segunda.
    3. Declarar na tarefa o bloco de mutação que remove as linhas 147-150 (ou esvazia o corpo do gancho) contra esse caso.

Recomendações:
- O comentário de `fila-de-saidas.ts:144` ("somem com a aba e com a sessão") merece citar o caso novo depois da correção, para o docblock não afirmar o que só a revisão garante.
- O `tempoTolerante` e o `provaOnlineTolerante` (`atividades-do-aluno.ts:58-60`) descartam campo desconhecido antes de conferir. Isso não vaza nada (só reduz), mas vale um comentário: um campo pessoal novo na API só seria descartado pela web e continuaria na resposta. A guarda de privacidade é o contrato estrito da API, não o cliente.

Arquivos citados:
- apps/web/src/areas/aluno/fila-de-saidas.ts
- apps/web/src/areas/aluno/fila-de-saidas.test.ts
- apps/web/src/areas/aluno/ProvaEmFoco.test.tsx
- tasks/prd-avaliacao-e-correcao/12_task.md

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-28 07:55:24 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO

Tela vista: sim, quatro fotos lidas, a lista Tarefas do aluno no computador e no celular, escola cheia e vazia. "Antes de começar" e a prova em foco não têm foto, porque a vitrine não tem prova online, então revisei os dois pelo código e pelo e2e `e2e/aluno-prova.spec.ts`. A tela de foco a 360 px e a faixa de uma linha não foram vistas. Ficam para a validação.

Rolagem: nenhuma tela passa de 1366 × 768, e o PRD não pede que a lista caiba na janela.

Estados: ok.
- A lista Tarefas tem carregando, erro com "Tentar de novo", vazio que convida e com dado.
- "Antes de começar" tem carregando, não disponível e erro com "Tentar de novo" (`AntesDeComecar.tsx:104-122`). O "Começar" que falha mostra `role="alert"` com texto de ação.
- A prova em foco tem carregando ("Abrindo a prova…"), não disponível e erro ("Não foi possível abrir a prova. Tente de novo.", `ProvaEmFoco.tsx:289-299`), mais os fins: tempo, encerrada e enviada.
- Os textos de erro não mostram código. O 503 e a queda dizem que as respostas estão guardadas. O limite por minuto diz "Aguarde um instante.".

Acessibilidade: ok pelo código e pelo e2e (axe no `chromebook` e no `celular`).
- O relógio fica fora de região viva. O aviso `polite` sai a 10, 5 e 1 min.
- O fim da prova tem `role="alert"` e recebe o foco. "Salvando…" é `polite` e aparece uma vez só.
- O foco vai ao enunciado ao entrar na prova e volta ao link da lista depois do "Sair da prova".
- Cada alternativa é um rádio dentro de um `fieldset` com `legend`, e o mapa das questões tem rótulo em texto.

Chromebook fraco: ok.
- O e2e roda com CPU ×4 no projeto `chromebook`.
- O relógio de 1 s fica num componente à parte, então a tela das questões não é redesenhada a cada segundo.
- A fila de respostas é em série, com a volta da rede espalhada de 0 a 5 s.
- A lista pagina com "Ver mais tarefas" e não rola sem fim. Não há imagem nem upload nesta tarefa.

Celular: ok nas fotos e no código.
- A lista a 360 px não rola de lado, e as linhas passam de 44 px.
- "Começar", "Sair da prova" e o mapa das questões (`size-11`) têm 44 px. "Anterior" e "Próxima" usam o botão secundário de 44 px.
- Nada depende de hover. O e2e confere a faixa de uma linha, a página sem rolagem lateral e "Sair da prova" com 44 px nos dois projetos.
- Nenhum fluxo exige o celular.

Ação oficial protegida: sim.
- "Enviar a prova" abre o `ConfirmDialog` oficial com a prova, as questões com resposta e as em branco, e segura o envio se houver resposta não salva.
- "Sair da prova" é de um clique e sem confirmação, como pede a D59. O aviso da D70 vem antes do "Começar", e nada na tela do aluno mostra a contagem de saídas.
- A tela não grava nada ao ler. Só o "Começar" cria a tentativa.

Bloqueantes: nenhum.

Recomendações:
1. `AntesDeComecar.tsx:90-91,100`: o "Começar" some quando o relógio do computador diz que a janela não abriu ou já fechou. Um Chromebook com hora errada impede o aluno de nem tentar. A divergência está escrita na tarefa e o caso `ProvaEmFoco.test.tsx:383-396` a prova de propósito, e a hora errada só pesa nas bordas da janela, por isso não bloqueia. Sugiro mostrar o texto "Esta prova abre em…" ou "fechou às…" como aviso e manter o botão, deixando o servidor recusar por `PROVA_FORA_DA_JANELA`, que a tela já trata.
2. `Atividades.tsx:35-58`: na foto do celular os títulos aparecem cortados ("Cinemática: lista sintét…", "Estequiometria: lista si…"). Isso vem do `ListItem` com `truncate` e não nasceu nesta tarefa, mas com o "Abre em…" na linha, dois títulos parecidos ficam indistinguíveis a 360 px. O `ListItem` já tem `emDuasLinhas` (`ListItem.tsx:64`); vale usá-lo na lista de tarefas.
3. `AntesDeComecar.tsx:81`: "Começar" usa a variante `oficial` (grafite), que `button-variants.ts` reserva para decisão oficial. Começar a prova não é decisão oficial, e a variante `primario` (laranja) seria mais fiel ao guia.
4. `Atividades.tsx:23`: `useAgora()` roda em cada linha, com um `setInterval` por linha. Subir esse hook para a lista deixa um timer só no Chromebook.
5. `atividade.ts:262,270`: "Chame o professor" convive com "quem dá a aula" no resto da tela. Vale unificar o vocabulário.

Arquivos relevantes (caminho completo em ``):
- `apps/web/src/areas/aluno/AntesDeComecar.tsx`
- `apps/web/src/areas/aluno/ProvaEmFoco.tsx`
- `apps/web/src/areas/aluno/Atividades.tsx`
- `apps/web/src/areas/aluno/Atividade.tsx`
- `apps/web/src/areas/aluno/atividade.ts`
- `e2e/aluno-prova.spec.ts`
- `.processo/vitrine/aluno--aluno-atividades--celular.png`
- `.processo/vitrine/vazia--aluno--aluno-atividades--celular.png`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 07:55:54 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A 12.0 só mexe na web, na fila de respostas e na de saídas da aba e nos apoios de e2e. O único caminho até a nota que a tarefa usa é `encerrarEAprovar` em `e2e/support/atividade-db.ts:158`, que já existia. Ele passa pela API como a professora: abre os destaques e depois chama `POST /v1/entregas/:id/aprovar-lote`. Nenhum apoio grava direto no banco. Todos com autor humano? sim.

Decisão autônoma sobre aluno: ausente. A tela não aprova, não reprova e não encaminha. O resultado só aparece depois da aprovação ("Quem dá a aula ainda vai revisar a correção.", "Correção aprovada por …"), e o e2e e o roteiro conferem os dois.

Aprovação registrada: ok. Nenhuma saída de IA nova chega ao aluno. O diagnóstico que ele vê sai do lote aprovado pela professora. O texto do fim ("Prova enviada. Quem dá a aula vê a correção antes de você.", `apps/web/src/areas/aluno/atividade.ts:434`) diz isso ao aluno. A exceção da D47 não aparece fora do Tutor.

Supervisão do tutor: ok. Na prova em foco o Tutor não aparece (`!emProva` em `Atividade.tsx`, e a tela fica fora da casca), o que bate com a pausa no servidor durante a avaliação.

Autonomia declarada e visível: sim, sem mudança. A tarefa não toca agente nem governança.

**Itens específicos desta tarefa**
- **D70 (saída da aba).**
  - O aviso vem antes do "Começar", em `AntesDeComecar.tsx:84`: "Se você sair desta aba, isso aparece para o professor. Nada acontece com a sua prova."
  - A rota da prova não pula o aviso: a prova que não começou volta à atividade (`ProvaEmFoco.tsx:310`), e o teste `o endereço digitado sem a prova ter começado…` cobre isso.
  - O contrato não permite duração sem janela (`camposInvalidosDaAvaliativa`, `packages/shared/src/atividade/atividade-aplicada.ts:101`). Por isso a tela antiga, que chama `comecar` sozinha, não cria prova com limite sem passar pelo aviso.
  - A vigia só fica ligada com a prova em andamento e sem fim na tela (`ProvaEmFoco.tsx:273`). Ela se desliga quando a tela sai.
  - A tela do aluno não mostra contagem nem soma, e o teste `ProvaEmFoco.test.tsx:270` e o e2e em `e2e/aluno-prova.spec.ts:189` conferem.
  - A fila leva só a `chave` e o id da prova, e nada aqui tem consequência sobre a prova.
- **D59 (sair e uso excessivo).** "Sair da prova" é um clique sem confirmação, na faixa, inclusive na tela de erro. Entrar custa dois passos (abrir e "Começar"). O relógio mostra minutos inteiros, sem contagem de segundos, e só avisa o leitor de tela a 10, 5 e 1 min. O ponto de parada aparece escrito.
- **D55 e D46.** Nada de discursiva ou de redação: a prova online é objetiva. Não há nota nem conceito proposto na tela do aluno.
- **Itens 7 e 8 da regra 70.** Não há inferência emocional nem medida de tempo ocioso. O `online`/`offline` é o do navegador e não é enviado. Nada mede o professor.
- **Fotos** (os quatro arquivos `.processo/vitrine/*aluno--aluno-atividades--*.png`, na escola cheia e na vazia, no computador e no celular): só "Corrigida", "A correção foi aprovada…" e "Quem dá a aula ainda vai revisar a correção." Não há nota nem conceito, e nada induz uso. "Antes de começar" e a prova em foco não foram fotografadas e foram revisadas pelo código.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/areas/aluno/Atividade.tsx:106`: o docblock de `Respondendo` diz "Nada aqui observa a janela, o foco ou a aba: sair e voltar não é medido (regra 70, item 7)." Com `emProva`, o mesmo componente roda dentro da tela que mede a saída da aba (D70). Sugestão de texto: "Este componente não observa a aba; na prova em foco, quem conta a saída é `ProvaEmFoco` (D70), e só durante a prova."
2. `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx:257`: o nome do caso diz "parar a prova não conta mais", mas o corpo não confere isso. Vale acrescentar o passo que falta: clicar em "Sair da prova", disparar `blur` e conferir que `saidas(rede)` não cresce. Assim o "só durante a prova" da D70 fica provado também na saída pelo botão, e não só no fim do tempo.
3. `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx:302`: o negativo de "a prova que já acabou não conta saída nenhuma" espera 50 ms de relógio de verdade. Fica mais firme assim: disparar `blur`, depois uma ação que gere chamada conhecida na rede (por exemplo, a releitura do `tempo`), esperar essa chamada e só então conferir que `saidas(rede)` está vazio.
4. A AIA da F6 (risco do D70) deve registrar que o `blur` da janela também conta quando o foco vai para a barra do navegador, o shelf do ChromeOS ou uma notificação do sistema. O techspec já marca o ChromeOS como "NÃO VERIFICADO". O aviso fixo para o professor cobre isso, mas o falso positivo fica documentado.

Arquivos lidos:
- apps/web/src/areas/aluno/AntesDeComecar.tsx
- apps/web/src/areas/aluno/ProvaEmFoco.tsx
- apps/web/src/areas/aluno/fila-de-saidas.ts
- apps/web/src/areas/aluno/Atividade.tsx
- apps/web/src/areas/aluno/atividade.ts
- apps/web/src/api/atividades-do-aluno.ts
- apps/web/src/areas/aluno/ProvaEmFoco.test.tsx
- e2e/aluno-prova.spec.ts
- e2e/support/atividade-db.ts

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 07:56:19 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova
Rate limit: ok (a tarefa não cria rota. O 429 da saída da aba espera o recuo na fila própria e não segura a fila de respostas)
Fila e prioridade: ok (a tarefa não cria job)
Concorrência: protegida (as saídas vão uma por vez, e cada uma guarda a mesma `chave` no reenvio; a fila de respostas não muda. Se o `redeVoltou` chegar com um envio no ar, ele não manda nada, porque `proximoEnvio` e o `noAr` o seguram)
Índice e paginação: ok (não há query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há código novo no servidor. `infra/test/carga-prova.test.ts` confere `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS` contra o `infra/k6/prova-online.js`, que já sorteia `Math.random() * ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS`)
Bloqueantes: nenhum
Recomendações:
- `apps/web/src/api/atividades-do-aluno.ts:162` (`tempoDaProvaQueryOptions`): com `staleTime: 0`, o `refetchOnReconnect` padrão do TanStack continua ligado. Quando o `online` dispara, o `GET …/tempo` de cada aluno sai no mesmo instante, inclusive a leitura que ficou pausada sem rede. Só as respostas e as saídas esperam o sorteio de 0 a 5 s. O custo é pequeno: uma escola, uma leitura barata por aluno, e a falha mantém o último limite. Mesmo assim, contradiz "a sala inteira não volta no mesmo segundo". Sugiro `refetchOnReconnect: false` nessa query, já que a batida de 30 s cobre a releitura, ou que o tempo também espere o sorteio.
- `apps/web/src/areas/aluno/AntesDeComecar.tsx:63`: o "Começar" grava o tempo no cache com `setQueryData`. Como `staleTime` é 0, o `ProvaEmFoco` relê `GET …/tempo` assim que monta, e cada "Começar" vira `POST …/comecar` mais um `GET …/tempo` desnecessário, justamente no pico da entrada das turmas. Um `staleTime` de alguns segundos na query do tempo, ou `refetchOnMount: false` com a batida de 30 s, evita a leitura dobrada.
- O k6 (`infra/k6/prova-online.js`) segue lendo o tempo só a cada 30 s. Ele não imita o que o app faz de verdade: ler ao montar, depois do "Começar", ao voltar o foco da aba e ao voltar a rede. Se as duas recomendações acima não forem adotadas, o cenário deveria repetir essas leituras para medir o tráfego real da entrada.
- `apps/web/src/areas/aluno/Atividades.tsx:25`: cada linha da lista liga o próprio `setInterval` de 30 s (`useAgora`). É só custo de CPU no cliente, mas no Chromebook fraco seria melhor um `agora` só, no componente pai, passado para as linhas.

Os quatro arquivos de teste da tarefa passaram: 118 casos em `fila-de-saidas.test.ts`, `respostas.test.ts`, `ProvaEmFoco.test.tsx` e `carga-prova.test.ts`.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-28 07:57:01 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: REPROVADO

Escopo: respeitado. As oito subtarefas foram feitas e nada avança sobre a 10.0 ou a 11.0. Dois arquivos novos não estão em "Arquivos previstos": `apps/web/src/areas/aluno/use-agora.ts` e `apps/web/src/api/atividades-do-aluno.test.ts`. Os dois só servem à própria tarefa.

Aderência à Tech Spec: ok. As três divergências da tarefa estão registradas:
- o texto de erro da porta: `techspec.md` §9 e `cenarios.md` §4;
- a janela lida pelo relógio do computador, com a palavra final do servidor (`PROVA_FORA_DA_JANELA`): `techspec.md` §9 e `cenarios.md` §4;
- o recomeço provado em teste de tela, e não em e2e novo: `cenarios.md` §4. É escolha de tipo de teste e não mexe em arquitetura.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes:
- **`docs/roteiro-da-demonstracao.md:236`**: o passo 4 diz "Carla (Aluno 3) só abre a atividade e não responde: ela vai virar destaque". A tarefa tornou isso falso.
  - Antes, abrir a atividade chamava `comecar` e criava a tentativa. Agora abrir a prova leva a "Antes de começar" (`apps/web/src/areas/aluno/AntesDeComecar.tsx:137`), e a tentativa só nasce no "Começar".
  - O encerramento não corrige quem não tem tentativa (`packages/core/src/atividade/encerramento.ts:106`: "Quem nunca abriu não tem correção").
  - Quem seguir o roteiro ao vivo vai ter "2 alunos responderam", "Aprovar 2 correções" e nenhum destaque da Carla. O passo 6.2 (linha 242: "destaques fechados (Carla, 'Em branco')", "Aprovar 3 correções") quebra na frente da escola.
  - O e2e não pega o erro: ele simula a Carla pela API com `responderPelaApi`, que chama `comecar` (`e2e/roteiro-da-demonstracao.spec.ts:516`).
  - A 12.6 tinha o roteiro como entrega, e a autoconferência (item 7) afirma que o roteiro "diz só o que os casos provam".
  - **Correção exigida:** reescrever o passo 4 para "Carla abre a prova, lê o aviso, toca **Começar** e sai sem responder", e alinhar o comentário de `e2e/roteiro-da-demonstracao.spec.ts:514` ("a Carla abre e não responde") ao que a API faz ali.

Recomendações:
- Há um segundo jeito de fazer algo que o projeto já faz. `FUSO_DA_ESCOLA` e `horaNaEscola` em `apps/web/src/areas/aluno/atividades.ts:32-68` repetem `FUSO_DA_PROVA` e `horaNaEscola` de `apps/web/src/areas/professor/atividades/prova-online.ts:25,77`, que já são a quarta cópia de `'America/Sao_Paulo'` na web. Como uma área não importa a outra, a conta do fuso da escola pode descer para `apps/web/src/format.ts`, numa versão só.
- Voltar a uma prova em andamento faz duas leituras de `GET …/prova`: a da porta (chave `'lida'`) e a de `ProvaEmFoco`, com outra chave. A atividade sem prova online faz três chamadas (a leitura, `comecar` e a leitura de novo), onde antes eram duas. A porta pode semear o cache de `provaEmFocoQueryOptions` com o que já leu (`AntesDeComecar.tsx:133-138`). É o caminho quente da manhã, e o `infra-guardian` pode querer ver.
- "Ela fecha às HH:MM" (`AntesDeComecar.tsx:83`) é um texto que `cenarios.md` §4 não lista. Ele também não diz o dia quando a janela fecha em outro dia, e o apoio do e2e usa uma janela de 24 h.
- Quando o "Começar" recebe resposta sem `comecou`, a tela não navega nem diz nada (`AntesDeComecar.tsx:59`): o aluno fica parado no botão.
- Faltou acrescentar `use-agora.ts` e `atividades-do-aluno.test.ts` à tabela "Arquivos previstos".

## test-engineer · 1ª rodada · REPROVADO · 2026-11-28 07:57:34 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: REPROVADO

Cenários exigidos (12.0):
- **Caminho feliz:** "Antes de começar", depois "Começar", depois a prova em foco com o relógio do servidor, as respostas salvas a cada escolha, "Sair da prova" de um clique e o fim.
- **Bordas:** relógio do computador adiantado; queda de rede no meio da prova; 503 e depois 200; `TEMPO_ESGOTADO` seguido da extensão; prova que ainda não abriu ou que já fechou; prova encerrada pela professora com resposta na fila; aluno que sai com respostas pendentes; prova embaralhada.
- **Permissão:** endereço digitado sem a prova ter começado; prova de outra turma (404, sem código); "Começar" recusado pelo servidor fora da janela.
- **Isolamento:** a tela não cria rota nem repository; o que importa é que a fila presa à sessão não sai com a sessão da pessoa seguinte.
- **Carga e concorrência:** a sala inteira voltando da queda no mesmo instante (reenvio sorteado de 0 a 5 s); "Tentar de novo" enquanto o sorteio corre; clique duplo em "Começar"; saídas da aba em série; o 429 da fila de saídas sem parar a de respostas.

Cobertos:
- **Linhas da tabela com teste citado e que existe:** relógio adiantado (unidade e tela); 503 e depois 200 (`puts` igual a 2); volta da rede com sorteio de 4 s e as três pendentes uma por vez; teto de 5 s; "Tentar de novo" cancelando o sorteio; o k6 com a mesma constante; "Enviar" com 503; `TEMPO_ESGOTADO`; fila de saídas (A, queda, B, A; chave própria; 429); "Antes de começar" com e sem janela.
- **Também cobertos:** acessibilidade (11 min sem aviso, 10 min `polite`, fim `assertive` com o foco, foco ao entrar e ao voltar); erros sem código; recomeço da fila de respostas; prova embaralhada na unidade e na tela, com um sorteio conhecido em que a posição da tela difere do índice original; os e2e citados; o roteiro.
- **Ferramenta e testes rodados:** `mutacoes.ts --faltando` dá vazio. Rodei `apps/web/src/areas/aluno` com `atividades-do-aluno.test.ts` e `paths.test.ts` (385 passaram) e `infra/test/carga-prova.test.ts` (20 passaram). Não há `.skip`, provedor de IA nem mock de peça nossa.

Bloqueantes:

1. **A fila de saídas presa à sessão não tem teste.** Em `apps/web/src/areas/aluno/fila-de-saidas.ts:147-150`, o `aoTrocarDeSessao` para e esvazia as filas de saída. Nenhum caso prova isso:
   - `fila-de-saidas.test.ts` não troca de sessão.
   - O recomeço em `ProvaEmFoco.test.tsx:862-897` só conta os `PUT` de resposta.

   Se esse gancho for apagado, a saída da aba da primeira pessoa sai com o token da segunda. O servidor tira o aluno do token, então o professor vê uma saída atribuída ao aluno errado (D70, regra 20). O `aoAbrirSessao`, que manda as saídas na hora (`fila-de-saidas.ts:151-153`), também não tem caso.
   - **Correção:** um caso com a sessão de verdade (`sair()` e `openSessaoPeloCookie()`, como no recomeço). Registrar uma saída com o envio parado ou falhando, trocar a sessão, disparar `online`, e exigir zero `POST …/saidas-da-aba` na rede da segunda pessoa. Somar um caso em que a sessão que volta manda a pendente na hora.

2. **Da linha "'Sair' com 2 pendentes" da tabela, a parte "a fila segue … até esvaziar" está sem teste.**
   - `Atividades.test.tsx:257-269` só confere o retrato fixo "2 respostas ainda não chegaram", com o servidor recusando para sempre.
   - `ProvaEmFoco.test.tsx:129-144` só confere a navegação, e com 1 pendente, não 2.

   Nada prova que a contagem anda e some quando o servidor confirma. Com o `fila.assinar(...)` que avisa os ouvintes removido (`fila-de-respostas.ts:221-223`, mais `assinarAsFilas`), a linha ficaria parada em "2" e o teste seguiria verde. Nada prova também que a fila continua mandando depois de a tela de foco sair, que é o "O que distingue" dessa linha: fila presa à rota.
   - **Correção:** usar um servidor controlado pelo teste.
     - Liberar uma resposta e exigir "1 resposta ainda não chegou".
     - Liberar a outra e exigir que o texto e a região de status sumam.
     - De preferência, partir da `ProvaEmFoco` com 2 pendentes, clicar "Sair da prova" e montar `Atividades` no mesmo `Router`.

3. **O caso da extensão é uma corrida contra o relógio de verdade.** Em `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx:616-640` ("a extensão chega depois de o servidor recusar por tempo…"), o caminho certo só grava quando o relógio da faixa bate depois do limite de 1 s. Esse relógio bate a cada 1 s a partir da montagem, então a gravação sai por volta de 2,0 s depois de `marcou`. A exigência é `< 2_300` ms (`waitFor` com `timeout: 2_300` e `Date.now() - marcou`). Sobram uns 300 ms para o atraso do `setInterval`, a releitura e a renderização. Num runner carregado o caso fica vermelho sem defeito: é teste que só passa com a máquina folgada.
   - **Correção:** relógio falso, como o bloco das linhas 806-860 já faz (`vi.useFakeTimers({ shouldAdvanceTime: true })` e `advanceTimersByTimeAsync`). Avançar até o relógio vencer o limite, exigir o segundo `PUT` e "Salvo" antes de chegar aos 2,5 s do recuo, e conferir que sem a releitura nada sai antes disso.

Recomendações:
- `ProvaEmFoco.test.tsx:194-195`: o título diz "cada uma é gravada uma vez", mas a asserção é `toBeGreaterThanOrEqual(1)`. Contar só os `PUT` feitos depois de `caiu = false` e exigir exatamente 1 por questão.
- `ProvaEmFoco.test.tsx:285`: a janela de 1 s contra o recuo de 1,5 s em relógio de verdade não fica vermelha à toa no caminho certo, mas sob carga pode deixar passar o mutante. Melhor com relógio falso.
- `e2e/aluno-prova.spec.ts:199-221`: nada garante que o sorteio tirou a alternativa certa da posição original. Em cerca de 1 execução a cada 64 (as três certas na posição original), o caso não distingue a tela que manda a posição. Ler a prova por `lerAProvaPelaApi` e exigir ao menos uma questão em que a posição da certa na tela seja diferente do índice original.
- Nenhum caso confere que `[data-salvo]` é `role="status"`, que é o "'Salvando…' `polite`" da linha de acessibilidade. Somar a asserção.
- `Atividade.test.tsx`, caso do diagnóstico: "A resposta é" só é conferido na questão sem sorteio (`itens[1]`). Na embaralhada, só o e2e confere. Somar a asserção na questão 3, que o aluno viu primeiro.
- O nome da linha da tabela fala em 2 pendentes, e o caso citado (`ProvaEmFoco.test.tsx:129`) tem 1. Alinhar quando o bloqueante 2 for corrigido.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-28 08:54:40 · `tasks/prd-avaliacao-e-correcao/12_task.md`

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
Recomendações:
- `apps/web/src/areas/aluno/fila-de-saidas.ts:151`: quando a sessão volta, o `aoAbrirSessao` chama `tryAgora` em todas as filas da aba ao mesmo tempo e sem sorteio. Para a carga isso não muda nada, porque cada aba só guarda as filas dela e a sessão volta aluno por aluno, nunca a escola inteira de uma vez. Ainda assim fica diferente do `online`, que espalha o reenvio em 0–5 s. Se um dia a sessão voltar para a escola toda junta (um deploy que derrube a sessão de todos, por exemplo), vale passar esse reenvio pelo mesmo sorteio. Não bloqueia.
- `apps/web/src/areas/aluno/AntesDeComecar.tsx:72`: cria o próprio `useAgora`, e isso está certo, porque essa tela está sozinha na rota. Fica o registro para que a próxima tela que montar várias linhas faça como a lista agora faz: ler o relógio uma vez no componente de cima e passar para as linhas.

Auditei só o diff `.processo/ordens/12_task-diff-r2.patch`. Fora os testes e os comentários, o único código de produção que mudou foi `Atividades.tsx`. Agora a lista lê o relógio uma vez só, com um intervalo de 30 s para todas as linhas, e não mais um intervalo por linha, o que alivia o Chromebook. Há teste que prova isso e o bloco de mutação dele.

Os outros pontos do diff estão cobertos:
- **Isolamento das filas entre sessões:** a saída da aba que não chegou não vai embora com a sessão da pessoa seguinte, e quando a sessão volta a saída pendente é mandada na hora. Os dois casos têm teste, e cada um tem o bloco de mutação dele.
- **Testes de tempo:** os de saída da aba e o de extensão do limite trocaram o relógio de verdade pelo relógio falso.
- **Gravação uma vez só:** o caso de queda da rede agora exige exatamente uma gravação por questão depois que a rede volta.

O cenário de carga (`infra/test/carga-prova.test.ts`) não mudou desde a 1ª rodada. Nenhum teste chama provedor pago.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-28 08:54:43 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas, cheia e vazia, 1366 e 360 px, só da lista `/aluno/atividades`). "Antes de começar" e a prova em foco não têm foto: a vitrine não tem prova online. Nesta rodada o diff não altera o código de produção dessas duas telas, só os testes. A única mudança de produção que afeta tela é em `Atividades.tsx`.

Estados: ok. Pelo código de `Atividades.tsx`:
- carregando: `LoadingState`, linha 114.
- erro com "tentar de novo": `ErrorState`, linhas 115-117.
- vazio: `EmptyState` que convida a agir, linhas 118-120, mais a linha tracejada de cada grupo.
- com dado: lista em três grupos.

Acessibilidade: ok.
- A região `role="status"` das respostas que não chegaram segue, e o caso de teste novo prova que a contagem anda e some.
- As respostas pendentes aparecem com texto, em `text-erro` e `font-medium`, não só com cor.
- O foco volta à linha da prova ao sair (`Atividades.tsx:103-110`).
- O selo de situação é sempre texto.

Chromebook fraco: melhorou. O `useAgora()` saiu de cada linha e passou a ser lido uma vez na lista, em `Atividades.tsx:98`. Agora há um só `setInterval` de 30 s, em vez de um por tarefa. O caso novo `a lista lê o relógio do computador uma vez só` confere isso, e a mutação correspondente está registrada. A página seguinte só carrega por pedido ("Ver mais tarefas"), sem rolagem infinita (D59).

Celular: ok nas fotos de 360 px, cheia e vazia.
- Não há rolagem horizontal nem texto sobreposto.
- As linhas são links de página inteira com ladrilho de 44 px.
- Os botões Sair e a barra inferior têm alvo suficiente.
- O selo ("CORRIGIDA", "ENTREGUE") quebra para baixo do texto sem esconder a ação.

Ação oficial protegida: sim, não se aplica a esta lista. "Sair da prova" é de um clique e sem confirmação (D59). O envio da prova tem tela própria, que não mudou nesta rodada.

Bloqueantes: nenhum.

Recomendações:
- Os títulos longos ficam cortados a 360 px: "Cinemática: lista sintét…" e "Estequiometria: lista si…", em `aluno--aluno-atividades--celular.png`, `Atividades.tsx:28-30`. A recomendação é a mesma da 1ª rodada. Já está no `TODO.md`, com o Arquiteto como dono, porque a prop `tituloEmDuasLinhas` do `ListItem` é reservada a título fixo e curto.
- O texto de `use-agora.ts` e os comentários dizem "relógio do computador" e deixam o servidor com a palavra final. Isso está correto, e a tela não decide nada oficial por ele.

Observação: a foto mostra o que o último e2e construiu. O código atual de `Atividades.tsx` é coerente com ela.

Arquivos relevantes (caminhos absolutos):
- `apps/web/src/areas/aluno/Atividades.tsx`
- `apps/web/src/areas/aluno/use-agora.ts`
- `.processo/vitrine/aluno--aluno-atividades--celular.png`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 08:54:44 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita, nos dois pontos:

- **Roteiro, passo 4** (`docs/roteiro-da-demonstracao.md:236-237`): agora diz que a Carla abre a prova, lê o "Antes de começar", toca **Começar** e sai pelo **Sair da prova** sem responder. Também diz que a tentativa só nasce no **Começar**. O código confirma: em `AntesDeComecar.tsx:57` e `:92`, só o botão chama `comecarProva`. Com isso, o passo 6.2 ("3 alunos responderam", o destaque da Carla em "Em branco", "Aprovar 3 correções") volta a bater com o encerramento, porque a Carla tem tentativa.
- **Comentário do e2e** (`e2e/roteiro-da-demonstracao.spec.ts:514`): agora diz o que a API faz ali. O `responderPelaApi` chama `comecar` antes de pular as respostas vazias (`e2e/support/aluno-api.ts:29-32`), o que equivale ao toque em "Começar".

O resto do diff desta rodada fecha achados de outros revisores e não abre nada novo para mim:
- Os casos de saída da aba agora usam relógio falso e testam a fila da primeira pessoa contra a sessão da segunda.
- A lista de Tarefas lê o relógio com um intervalo só.
- O teste da extensão também passou ao relógio falso.
- A prova embaralhada do e2e só é usada quando o sorteio tirou alguma certa do lugar.
- Os docblocks em `atividades-do-aluno.ts` e `fila-de-respostas.ts` foram corrigidos, e a tabela e as mutações do `12_task.md` foram atualizadas.

Recomendações:
- `docs/roteiro-da-demonstracao.md:236`: o passo 4 diz "Bruno (Aluno 2) responde e envia" sem citar o **Começar**. Quem apresenta pode tirar sozinho que ele também precisa tocar no botão, mas vale escrever "Bruno começa, responde e envia", para o roteiro não deixar o passo implícito.
- `e2e/aluno-prova.spec.ts:565-583`: o `montarCenaEmbaralhada` pode refazer a aplicação até 6 vezes. A chance de esgotar as tentativas é desprezível, mas o caso fica mais lento quando o sorteio não colabora. Um sorteio determinístico no seed do teste (se a API aceitar) tiraria o laço.
- A recomendação do `frontend-reviewer` (título cortado a 360 px) ficou no `TODO.md`, com dono e motivo. Está registrada direito, só lembro que segue aberta.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-28 08:54:51 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff desde a 1ª rodada não cria migration nem tabela, e `git status` não mostra nada alterado em `apps/api` nem em `packages`.

Queries verificadas: nenhuma query nem repository novo no servidor. A mudança em `apps/web/src/areas/aluno/Atividades.tsx`, que reabriu a rodada, só passa a chamar `useAgora()` uma vez na lista, em vez de uma vez por linha, e repassa o `agora` às linhas. Ela não muda o que se lê nem o escopo. A tela continua sem mandar `escolaId` nem `alunoId`, e a rota tira os dois do token.

Teste de isolamento: presente e efetivo. Esta tarefa não tem servidor, e o isolamento entre escolas continua coberto pelos testes da 3.0 e da 4.0. No que a web faz sozinha, a fila presa à sessão, o caso novo em `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx` ("a saída da aba que não chegou da primeira pessoa não sai com a sessão da segunda") quebraria se o `filas.clear()` saísse do `aoTrocarDeSessao` em `apps/web/src/areas/aluno/fila-de-saidas.ts:147-150`. Sem a limpeza, a saída pendente da primeira pessoa iria com o token da segunda, e o `toHaveLength(0)` falharia. Os blocos de mutação da tarefa cobrem esse caso.

Bloqueantes: nenhum.

Recomendações:
- `apps/web/src/areas/aluno/fila-de-respostas.ts:193`: `respostasQueNaoChegaram` lê a fila só pelo `atividadeAplicadaId`. Isso está certo porque o `aoTrocarDeSessao` em `fila-de-respostas.ts:199-203` esvazia as filas e avisa quem está ouvindo, e o docblock novo registra essa dependência. Falta um caso do lado da lista de Tarefas que prove que a contagem "N respostas ainda não chegaram" da primeira pessoa não aparece na lista da segunda depois do `sair()`. Hoje só a fila de saídas tem esse caso.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-28 08:54:56 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff só mexe na web do aluno, em testes, comentários, e2e e docs. Não há tabela, repository, rota, job, seed nem importação nova. Os caminhos que existem já têm autor humano? sim, nada mudou neles.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nas fotos, a lista só mostra "Corrigida" e "A correção foi aprovada" depois do lote aprovado (`.processo/vitrine/aluno--aluno-atividades--computador.png` e `--celular.png`). Antes disso aparece "Entregue" com "Quem dá a aula ainda vai revisar a correção." (`.processo/vitrine/vazia--aluno--aluno-atividades--computador.png` e `--celular.png`). Nenhuma nota, conceito ou acerto aparece na lista (`apps/web/src/areas/aluno/Atividades.tsx:36-50`).
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim. A tarefa não toca agente nem governança.
Bloqueantes: nenhum

O que mudou desde a 1ª rodada foi conferido assim:
- **`Atividades.tsx:98`**: o relógio do computador (`useAgora`) passa a ser lido uma vez pela lista inteira, e não por linha. É só desempenho e não tem efeito regulatório. A linha continua sem contagem regressiva, sem "atrasada" e sem recompensa (D59). A paginação continua por pedido do aluno, sem rolagem infinita (`:130-135`).
- **D70 (saída da aba só durante a prova)**: o caso novo em `ProvaEmFoco.test.tsx` prova que, depois do "Sair da prova", a aba que perde o foco não conta mais. Quem garante isso no código é `useVigiaDaSaida` (`ProvaEmFoco.tsx:231-236`): a contagem só liga com a prova em andamento e se desliga quando a tela sai. O caso "a prova que já acabou não conta saída nenhuma" agora usa relógio falso de 5 s, em vez de 50 ms reais, e ficou mais forte. A tela do aluno continua sem mostrar a soma das saídas.
- **D70 com regra 20 (a saída não vai para outra pessoa)**: o caso novo prova que uma saída que não chegou ao servidor, feita pelo primeiro aluno, não é enviada com a sessão do segundo aluno na mesma aba. Isso vale para a volta da rede e para o reenvio. O código que faz isso é `fila-de-saidas.ts:147-150`, e há mutação registrada para ele. Sem isso, a contagem de saídas seria atribuída à pessoa errada.
- **O comentário de `Atividade.tsx:106`** deixou de dizer "nada aqui observa a aba" e agora diz que quem conta a saída é `ProvaEmFoco`, só durante a prova. Agora o comentário diz o que o código faz.
- **`docs/roteiro-da-demonstracao.md:236-237`** e o e2e do roteiro: a aluna que vira destaque é a que tocou em "Começar" e não respondeu. O destaque é o "fora da curva" mostrado à professora antes de aprovar o lote (D33). Não é decisão automática sobre a aluna.

Recomendações:
- Fotos de "Antes de começar" e da prova em foco quando a vitrine tiver prova online. O aviso de D70 antes do "Começar" e o "Sair da prova" com um clique (D59) foram conferidos só pelo código e pelos testes.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-28 08:55:12 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO

A correção que exigi na 1ª rodada foi feita nas três partes. O resto do diff não cria campo, log nem envio, e não muda nenhuma leitura.

Campos pessoais tocados: nenhum campo novo. O diff só mexe em testes, comentários, no relógio único da lista e no texto do roteiro. A saída da aba continua levando só a `chave` (uuid v4) e o id da aplicação.

Fora da tabela de dados do docs/lgpd.md: nada. Não há tabela, campo nem migration.

Autorização por objeto: ok. A tarefa não cria rota. O diff não altera o que a tela manda ao servidor.

Logs: limpos. Nenhum `console` nem `logger` entrou no diff.

Auditoria: não se aplica. São ações do próprio aluno, e nenhuma está na lista da regra 20, item 10.

Envio externo: nenhum.

Seed/fixture: sintético. O e2e novo, `montarCenaEmbaralhada` em `e2e/aluno-prova.spec.ts:573`, monta cenas sintéticas, e "Carla", no roteiro, é personagem de demonstração.

Conferência das três partes da correção:
1. **Caso com a saída pendente.** O caso novo está em `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx:953` e se chama "a saída da aba que não chegou da primeira pessoa não sai com a sessão da segunda". Nele, o servidor recusa `saidas-da-aba` com queda (`TypeError('Failed to fetch')`) depois do `blur`, e a saída fica na fila. O `cleanup()` desmonta a tela e não para a fila, porque `ProvaEmFoco` só liga e desliga a vigia (`ProvaEmFoco.tsx:234`). Por isso o único jeito de a fila não sobreviver é o gancho.
2. **Troca de sessão.** O caso chama `sair()`, que leva a `esquecerSessao` e dispara `aoTrocar`. Depois cria a rede da segunda pessoa antes de `openSessaoPeloCookie()`, para pegar o `tryAgora` do `aoAbrirSessao`. Com o sorteio em 0, dispara `online`, avança 10 s no relógio falso e exige `toHaveLength(0)` na rede da segunda. Em seguida exige que a saída da própria segunda chegue uma vez, com `token-da-segunda`. É essa metade que derruba a mutação que tira só o `filas.clear()`, porque sem ela a fila parada da primeira pessoa seria reaproveitada.
3. **Mutações declaradas.** São três blocos contra o caso, em `tasks/prd-avaliacao-e-correcao/12_task.md:1486-1514`: sem o `stop()`, sem o corpo inteiro e sem o `clear()`. Há ainda um quarto, para o `aoAbrirSessao`, contra o caso novo "a sessão que volta manda a saída… na hora" (`ProvaEmFoco.test.tsx:988`). Não rodei as mutações, porque não edito arquivos. Mas `.processo/portao-12-r1b.log` mostra as mutações 187 a 190 vermelhas, o portão verde com 191 mutações, e o arquivo `fila-de-saidas.ts` restaurado igual ao que li.

As duas recomendações da 1ª rodada também foram atendidas:
- O docblock de `apps/web/src/areas/aluno/fila-de-saidas.ts:144` agora cita o caso.
- `apps/web/src/api/atividades-do-aluno.ts:55-56` agora diz que descartar o campo a mais não é a guarda de privacidade, e que quem barra campo pessoal novo é o contrato estrito da API.

Pergunta de fechamento: a tarefa não cria dado novo sobre o aluno nem envio novo. A saída da aba já está no servidor desde a 4.0, presa à tentativa. E agora há teste provando que a saída não é atribuída ao aluno errado no computador compartilhado.

Bloqueantes: nenhum.

Recomendações:
- O comentário novo em `apps/web/src/areas/aluno/fila-de-respostas.ts:526` diz que a limpeza que mantém a contagem certa é do `aoTrocarDeSessao`. Vale citar ali também o caso de teste que a prova, como já foi feito na fila de saídas.
- `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx:960` prepara `/\/v1\/sessao\/sair/`, e `:994` prepara `/\/v1\/sessao$/`. Se o `DELETE` vai para `/v1/sessao`, o primeiro caso cai no `catch` do `sair()`. O caso continua válido, porque o `finally` esquece a sessão e dispara o gancho do mesmo jeito. Alinhar os dois evita uma leitura enganosa do teste.

## test-engineer · 2ª rodada · APROVADO · 2026-11-28 08:56:37 · `tasks/prd-avaliacao-e-correcao/12_task.md`

VEREDITO: APROVADO

**Cenários exigidos (2ª rodada, as três correções da 1ª):**
1. A fila de saídas fica presa à sessão. Ao trocar a sessão, a fila para e esvazia, e nada sai na rede da segunda pessoa. A sessão que volta manda na hora a saída que ficou esperando.
2. "Sair" com 2 pendentes: a contagem vai de 2 para 1 e depois some, com o servidor controlado pelo teste.
3. A extensão chega depois do `TEMPO_ESGOTADO`, provada com relógio falso e não contra o relógio de verdade.

**Cobertos:**
1. Feita. Dois casos novos em `apps/web/src/areas/aluno/ProvaEmFoco.test.tsx` (bloco "o recomeço"):
   - **"a saída da aba que não chegou da primeira pessoa não sai com a sessão da segunda"** (linhas 952-985). Usa `sair()` e `openSessaoPeloCookie()` de verdade e uma rede nova para a segunda pessoa. Dispara `online` e avança 10 s falsos, e exige zero `POST …/saidas-da-aba`. Depois exige que a saída da segunda chegue uma vez só, com o token dela. Conferi no código por que cada mutação fica vermelha:
     - Sem o `stop()`: a fila antiga continua viva fora do mapa, e o recuo dela manda a saída pela rede da segunda.
     - Sem o `stop()` e sem o `clear()`: o `online` alcança a fila antiga.
     - Sem só o `clear()`: a segunda tela recebe a fila parada, e o `registrar` vira no-op. A asserção "chega, uma vez só" pega isso.
     - O desmontar da tela não para a fila (`ProvaEmFoco.tsx:234` só liga a vigia). Por isso o caso alcança de fato a cláusula `fila-de-saidas.ts:147-150`.
   - **"a sessão que volta manda a saída da aba que ficou esperando na hora"** (linhas 987-1012). Usa `encerrarPorInatividade` e um `blur` sem sessão, com o recuo em 2,5 s (`random=1`). Depois `openSessaoPeloCookie` faz a saída sair dentro do `waitFor` de 1 s, com o token novo. Sem o `tryAgora` (`fila-de-saidas.ts:151-153`) o recuo só vence depois, e o caso fica vermelho com folga.
2. Feita, nos dois lados:
   - `Atividades.test.tsx:257-279` segura as duas respostas no servidor e as libera uma de cada vez. Exige "1 resposta ainda não chegou" com `role=status`, e depois exige que o texto e a região de status sumam.
   - `ProvaEmFoco.test.tsx:149-182` monta a tela na rota de verdade, faz 2 pendentes reais, clica "Sair da prova", confere que a tela saiu e acompanha a fila de 2 para 1 e para 0.
   - A sugestão opcional de montar `Atividades` no mesmo `Router` não foi seguida. Os dois casos somados cobrem a linha da tabela.
3. Feita. `ProvaEmFoco.test.tsx:679-708` usa `vi.useFakeTimers({ shouldAdvanceTime: true })` e `passar()`:
   - Aos 500 ms falsos: um `PUT` só, e a tela ainda em "Salvando…".
   - Depois de mais 700 ms: o segundo `PUT` e "Salvo".

**Extras do diff, conferidos:**
- O caso do 503 agora exige exatamente uma gravação por questão depois da volta da rede (`slice(tentadasNaQueda)` com `toHaveLength(1)`), em vez de "pelo menos uma".
- "Sair da prova" desliga a vigia: um `blur` depois de sair não conta (linhas 354-361).
- Os negativos da saída da aba avançam 5 s falsos, e não esperam mais 50 ms de verdade.
- A lista de Tarefas cria um intervalo só de 30 s, com bloco de mutação para `Date.now()`.
- O diagnóstico embaralhado agora tem as duas questões erradas, e o caso exige "A resposta é: B. Quatro".
- O e2e passou a montar uma cena em que o sorteio deslocou a alternativa certa (`montarCenaEmbaralhada`).
- `npx vitest run` em `ProvaEmFoco.test.tsx`, `Atividades.test.tsx` e `Atividade.test.tsx`: 104 de 104 passaram.
- Não há `.skip` nem teste comentado, e nenhum mock esconde a regra. A tarefa não chama IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Folga estreita para pegar a mutação da extensão** (`apps/web/src/areas/aluno/ProvaEmFoco.test.tsx:701-703`). Com `shouldAdvanceTime`, o tempo real também anda o relógio falso, e o `waitFor` padrão espera até 1 s.
   - Somando os 1,2 s falsos, o mutante (sem o reenvio quando o limite anda) chega perto de 2,2 s mais o tempo de execução. O recuo vence aos 2,5 s.
   - Numa máquina carregada, o mutante pode ficar verde. O comportamento certo não fica vermelho por isso.
   - Sugestão: conferir `expect(puts(rede)).toHaveLength(2)` logo depois do `passar(700)`, ou dar ao `waitFor` um `timeout` de 200 ms.
2. **Comentário com número errado** (`ProvaEmFoco.test.tsx:373`). Diz "o menor recuo … é de 1,1 s", mas `esperaAntesDeTentar(1)` com o sorteio em 0 dá 1,5 s (2 s menos 25%), como o título do caso diz.
3. **Mock sem uso** (`ProvaEmFoco.test.tsx:459`). O caso responde `/\/v1\/sessao\/sair/`, mas o `sair()` faz `DELETE /v1/sessao` (`sessao.ts:676`). Esse `DELETE` cai no `catch`, e o caso só passa porque o `finally` esquece a sessão. O caso irmão (linha 493) já usa `/\/v1\/sessao$/`; usar o mesmo aqui.
4. **Tabela de testes desatualizada** (`tasks/prd-avaliacao-e-correcao/12_task.md:80`). A linha "Recomeço" diz "a fila da primeira pessoa não sai com a sessão da segunda", mas só cita o caso da resposta. Os dois casos novos de saída aparecem nos blocos de mutação e não estão em nenhuma linha da tabela: citá-los nessa linha ou na "Fila de saídas" (linha 75).
5. **Bloco de mutação sem `falha:`** (`12_task.md:1505-1511`, só o `clear()` removido). Não traz a linha `falha:`. Quem lê não sabe qual asserção deveria pegar a mutação: é a da linha 481, a saída da segunda que tem de chegar.
