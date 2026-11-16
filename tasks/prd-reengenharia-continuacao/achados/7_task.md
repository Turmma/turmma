# Achados das revisões — `tasks/prd-reengenharia-continuacao/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 06:52:42 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. `execucao_agente` (já tem `escola_id` e `ano_letivo_id`) passa a ter dois `update` novos sobre ela. Nenhuma tabela nova de leitura em `consumo_ia`.

Queries verificadas:
- `apps/api/src/ia/execucao.repository.ts` `marcarRodando`: além da idade nova, filtra por `escolaId` vindo de `requireEscolaId()`, pelo id e por `estado = 'pendente'`.
- `apps/api/src/ia/execucao.repository.ts` `cortarEspera`: filtra por `escolaId` vindo de `requireEscolaId()`, pelo id, por `estado = 'pendente'` e pela idade calculada no banco.
- `apps/api/src/ia/execucoes.service.ts` `ler`: só chega ao corte depois de `deQuemPediu` achar a linha, e essa leitura já filtra por escola, ano em curso e `solicitadaPor` do token. A releitura usa o mesmo escopo. O 404 sai antes de qualquer escrita, e é o mesmo para outra escola, para outra pessoa da mesma escola e para id inexistente.
- `apps/api/src/ia/execucao.processor.ts` `#comecar` e `#cortarEspera`: rodam no contexto da escola do job, depois de a leitura escopada achar a linha.
- `apps/api/src/ia/varredura-de-execucoes.ts`: as duas `@Unscoped` da 6.0 não mudaram e continuam com justificativa escrita. A métrica usa a `escolaId` da própria linha encerrada.
- Nenhum endpoint recebe `escolaId` do corpo ou da query. As métricas e o alerta levam só `escola_id`, para a operação (D76). Nenhum dado individual chega à camada de rede.

Teste de isolamento: presente e efetivo.
- "isolamento, job" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/corte-da-espera.int.test.ts:233`) chama `cortarEspera` e `marcarRodando` no contexto da escola A com a execução da B e espera `false`, sem escrita. Depois corta no contexto da B, como controle. Se a cláusula `escolaId` de `cortarEspera` sair, o teste quebra, e a mutação está declarada com `falha: toBe(false)`.
- "isolamento: o GET de usuário da B…" (linha 312) faz três pedidos: um usuário da B, outro aluno da mesma escola e um id inexistente. Os três recebem o mesmo 404 e a versão da linha (`xmin`) não muda. Cortar antes da leitura escopada deixaria uma escrita, e o teste pegaria.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts` `cortarEspera` (e `marcarRodando`, que já era assim): nenhum dos dois filtra por `anoLetivoId`. Hoje isso não vaza nada, porque os dois só rodam depois de uma leitura escopada pela escola, e o id é UUID. Mesmo assim, incluir o ano deixaria o `update` com o mesmo escopo da leitura do `GET`.
- O teste do `GET` não prova sozinho a cláusula de escola de `cortarEspera`, porque a leitura escopada barra antes. Quem prova é "isolamento, job". Vale citar essa dependência no comentário do caso do `GET`.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-16 06:52:44 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO

Tela vista: sim (6 fotos lidas, cheia e vazia, 1366 e 360 px). As fotos mostram a lista de atividades, a conversa sem pergunta e o estado vazio. Não vi o estado desta tarefa (pergunta cortada com "Tentar de novo" e a mensagem fixa da D36) porque a vitrine não o alcança. Revisei esse estado pelo código e pelos testes, sem rodar o e2e.

Estados: ok.
- Vazio: "Nenhuma atividade para pedir ajuda agora" e "Nenhuma pergunta ainda". Os dois dizem o próximo passo e não pedem desculpa.
- Erro: a falha cortada aparece dentro da conversa, como `FalhaNaConversa` em `apps/web/src/areas/aluno/Tutor.tsx:110-126`. Mostra "O Tutor não conseguiu responder agora. Tente de novo." com "Tentar de novo". Não mostra o código nem o erro cru, e não usa vermelho (`bg-info-cx`).
- Carregando e com dado: não mudaram.

Acessibilidade: ok.
- O botão usa o `Button` padrão, com `min-h-11`.
- A conversa é um `role="log"` rotulado.
- O ícone é `aria-hidden`.
- A ordem no documento é a mensagem fixa e depois o botão, que é a ordem que o leitor de tela anuncia.
- O e2e novo confere que o fim do cartão do 188 vem antes do início do botão, que o botão tem pelo menos 44 px e que não há `role="alert"`.
- O link `tel:188` está conferido.

Chromebook fraco: nada novo no cliente. A mudança é uma passada curta sobre as últimas mensagens em `apps/web/src/areas/aluno/tutor.ts:146-150`, sem custo de renderização.

Celular:
- Em 360 px não há rolagem horizontal nem texto cortado nas fotos.
- O alvo de toque do botão tem 44 px.
- O e2e `a pergunta cortada por esperar mais de 20 s…` roda `paginaNaoRola` e confere 44 px de altura.
- Nada depende de hover, e o fluxo não exige o celular.

Ação oficial protegida: sim. A tarefa não cria nota, publicação nem envio à família, e o tutor segue na exceção da D47. A mensagem fixa com o 188 (D36) nunca fica abaixo do "Tentar de novo". A conversa lida traz a pergunta uma vez só, e o texto novo em `tutor.ts:146-150` evita que ela apareça duas vezes depois da mensagem fixa.

Bloqueantes: nenhum.

Recomendações:
- `docs/interface.md` (por volta da linha 2294) diz que "o botão tem 44 px". Isso vem do `Button` padrão e o e2e prova. Um `grep` pelo `min-h-11` no componente ajudaria quem ler a doc depois.
- `7_task.md` lista `Tutor.tsx` como arquivo alterado, mas ele não mudou. A correção está em `tutor.ts` (`pendenteNoTutor`) e o `FalhaNaConversa` já existia. Vale ajustar a tabela de arquivos previstos para a retro não estranhar.
- As fotos `aluno--tutor--*` são de uma página "não encontrada" e ficaram fora da revisão, como o prompt pediu.
- A validação deve fotografar o estado cortado com a mensagem fixa em 360 px, se a vitrine ganhar uma execução cortada.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/tutor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/Tutor.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/Tutor.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/aluno-tutor.spec.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 06:53:35 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO

O corte da espera de 20 s não grava dado de pessoa novo e não abre nenhum caminho novo para dado sair. Não encontrei bloqueante.

Campos pessoais tocados: nenhum. Não há migration nem coluna nova. A tarefa só escreve `estado`, `erro` e `concluida_em` em `execucao_agente`, nada que identifique alguém.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- No `GET /v1/execucoes/:id` (`apps/api/src/ia/execucoes.service.ts:268-281`), a leitura vem antes de qualquer escrita. `deQuemPediu` (`apps/api/src/ia/execucao.repository.ts:292-297`) filtra pela escola, pelo ano letivo e por `solicitadaPor` (quem pediu), tudo tirado do contexto. Só depois roda o `cortarEspera`, que também filtra por escola.
- Se eu troco o id na URL, um aluno da escola B, outro aluno da mesma escola e um id inexistente recebem o mesmo 404 `NAO_ENCONTRADO`, sem escrita e sem métrica. O teste `corte-da-espera.int.test.ts:312-328` prova isso, e prova também que o corpo da resposta é igual nos três casos.
- No processador, o job da escola A com o id de uma execução da B não muda nada na B (caso "isolamento, job").

Logs: limpos. O evento `ia.execucao.espera_estourada` (`execucao.processor.ts:140`, `execucoes.service.ts:277`) leva só `execucaoId`, `escolaId`, `tipo` (o nome da tarefa) e `codigo`. Não leva o texto da pergunta nem o nome do aluno. Um teste com lista fechada de chaves prova isso (`corte-da-espera.int.test.ts:413-425`). A consulta SQL que o runbook sugere (`docs/runbook.md:242`) só traz ids, estado e horários, nunca conteúdo.

Métricas: `ia.espera_estourada` e `ia.execucao.interrompida` só têm o rótulo `escola_id` (e `origem` na segunda). Um teste confere que nenhum id de aluno, de professor ou de execução aparece nos rótulos (`corte-da-espera.int.test.ts:429-443`). Também entraram na lista fechada de `metrics.test.ts` e de `metricas.int.test.ts`.

Auditoria: não se aplica. O corte é decisão do sistema sobre a fila. Não é leitura de dado de aluno por coordenação ou rede, nem exportação, nota, permissão ou aprovação de saída de IA.

Envio externo: nenhum. A pergunta cortada não chega ao modelo. Os testes contam as chamadas (`modelo.chamadas() === 0`) e conferem que não há linha em `consumo_ia`. Mesmo cortada, a execução continua registrada em `ExecucaoAgente`, com estado e erro. Por isso a pergunta de fechamento continua respondida para esse caso: o registro mostra a tentativa e que nada foi enviado.

Tela: as fotos de `/aluno/tutor` (computador e celular, escola cheia e vazia) mostram só dados sintéticos ("Aluno Sintético Caio 2809d14a", "Colégio sintético da vitrine cheia"), e cada aluno vê o próprio nome. O estado novo (pergunta cortada, com a mensagem fixa da D36) não dá para ver na vitrine, então revisei pelo código. A mudança em `apps/web/src/areas/aluno/tutor.ts:446-451` só tira a pergunta repetida quando a mensagem fixa vem gravada depois dela. Não aparece dado novo, e o erro chega ao aluno sem o código nem a mensagem crua (o e2e confere `IA_INDISPONIVEL`, 503 e a mensagem de erro).

Seed/fixture: sintético. Os testes usam "não entendi", "resposta sintética" e "sofro bullying na escola", com ids aleatórios.

Bloqueantes: nenhum.

Recomendações:
1. `docs/runbook.md:821`: a entrada "uma escola" manda registrar "a escola (id)" no `TODO.md`. A entrada "várias escolas" (`docs/runbook.md:843`) e a "Pedido de IA acima do teto" (`docs/runbook.md:797`) dizem "sem id de escola: o repositório é público". Vale escolher um padrão só. O id da escola não é dado de titular, mas o repositório é público. Outras entradas antigas do runbook (l.88, 585, 668…) seguem o padrão da 821, então a divergência já vinha de antes.
2. `apps/api/src/ia/execucao.repository.ts:214-228`: hoje quem garante o dono no `cortarEspera` é a ordem das chamadas no `GET` (primeiro lê, depois corta). Como reforço, uma variante para o `GET` poderia incluir `solicitadaPor` e `anoLetivoId` no próprio `where`. Assim, um futuro chamador que pular a leitura não corta a execução de outra pessoa. Hoje não vaza nada, porque o único chamador lê antes.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 06:53:52 · `tasks/prd-reengenharia-continuacao/7_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: tutor | fila | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
1. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucoes.service.ts:32 e :40
   A tela consulta de segundo em segundo. Cada consulta a uma pergunta do Tutor ainda `pendente`, mesmo com 1 s de idade,
   hoje faz três idas ao banco: um SELECT, um UPDATE que não muda nenhuma linha e outro SELECT. Hoje o custo é baixo
   (busca pela chave, e o UPDATE que não muda linha não grava no log do banco). Mesmo assim, dá para trazer a idade
   (`now() - criada_em`) já na primeira leitura e só tentar o corte e reler a linha quando ela passou de 20 s. Isso tira
   duas queries por consulta às 10h.
2. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/grafana/alertas/ia-espera-estourada-por-escola.yaml:48 e :94
   A conta `soma - soma offset 10m` não trata o contador que volta a zero. Um restart ou deploy de uma réplica da API ou do
   worker-ia nos últimos 10 min baixa a diferença, que pode até ficar negativa, e esconde cortes de verdade. O runbook
   registra isso, mas o deploy com várias réplicas deixa a lacuna mais frequente do que parece. Vale avaliar
   `sum by (escola_id) (increase(...[10m]))` somado a uma série zero no nascimento, ou o `resets()`, antes do piloto.
3. /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/k6/justica-entre-escolas.js:282
   Na carga, um `falhou` entra em `respostas_inesperadas` sem separar o corte da espera (`IA_INDISPONIVEL`, a degradação
   que a 7.0 criou) de uma falha de verdade. Na `FASE=sala` (tarefa 11.0), conte os cortes num contador próprio, com
   limite próprio. Do contrário, um pico que corta perguntas reprova a carga sem dizer que o motivo foi a vaga.
```

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 06:54:23 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As cinco divergências da tabela da tarefa estão escritas na `techspec.md` §5, no bloco "Como a 7.0 ficou", itens 1 a 6. O contador `ia.execucao.interrompida` também está no `cenarios.md` §1. A §7c fala em um alerta "IA: espera estourada", e o código entrega duas regras; isso está registrado no item 5.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo)
Bloqueantes: nenhum

Recomendações:

1. **A combinação "corte pela espera e mensagem fixa juntos" não acontece no sistema, mas o código e os documentos dizem que sim.** Ela aparece em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/tutor.ts:146`, no comentário "o worker a grava mesmo com a execução descartada ou cortada pela espera". A mesma ideia está no título do teste em `apps/web/src/areas/aluno/tutor.test.ts:172`, no docblock e em `montar` de `apps/web/src/areas/aluno/Tutor.test.tsx` (que diz "como o `#encaminhar` faz antes da fila"), no título do caso novo de `e2e/aluno-tutor.spec.ts:416` e no item de `docs/interface.md:2294`.
   - O `#encaminhar` deixa a execução `concluida` (`apps/api/src/tutor/tutor.service.ts:168`), e não `falhou`.
   - A mensagem fixa que vem da classificação do modelo exige que a execução já esteja `rodando`. Uma execução `rodando` nunca é cortada pela espera.
   - O caso real é o do `cenarios.md` §2, linha 91: a mensagem fixa gravada e a execução encerrada pela varredura, que fica `falhou EXECUCAO_INTERROMPIDA`.
   - O `pendenteNoTutor` não olha o código do erro, então a lógica está certa para esse caso real. O que precisa mudar é o texto: o comentário, os títulos e a frase da `interface.md` devem nomear o caso real. Se a tela tratar `EXECUCAO_INTERROMPIDA` como `tentar`, um caso unitário com esse código prova o caso que de fato existe.
2. **O `GET` pode dar erro 500 onde antes respondia.** Em `apps/api/src/ia/execucoes.service.ts:31`, `this.comandos.de(execucao.tarefa)` lança `InvariantException` quando a tarefa não tem comando registrado, como `relatorio_da_correcao`. Antes da tarefa, uma `pendente` dessa tarefa era lida sem erro. Hoje nenhuma execução dela é criada, então o risco é pequeno. Ainda assim, ler a fila sem lançar exceção, ou tratar "sem comando" como "sem corte", evita trocar uma leitura por um 500.
3. **As duas entradas novas do runbook mandam coisas diferentes ao `TODO.md`.** A de "uma escola" (`docs/runbook.md:531`) manda registrar "a escola (id)". A de "várias escolas" e a de "Pedido de IA acima do teto" mandam não registrar id de escola, porque o repositório é público. Vale alinhar com a segunda.
4. **O mesmo trecho aparece duas vezes.** A soma da métrica, o log `ia.execucao.espera_estourada` e o `tipo`/`codigo` estão iguais em `execucao.processor.ts` (`#cortarEspera`) e em `execucoes.service.ts:31-36`. Um método só, por exemplo dentro de `MetricasDaExecucao` ou ao lado de `cortarEspera`, impede que os dois lados se afastem.

As fotos da vitrine (`aluno--aluno-tutor--*`) mostram a lista de atividades e a conversa vazia. Batem com o RF e não mostram nada que a tarefa não pediu. O estado da tarefa, a pergunta cortada, só pôde ser revisto pelo código e pelos testes, como o prompt indicava.

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-16 06:54:34 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca `Nota`, correção nem lançamento. Todos com autor humano? sim, porque nada mudou.

Decisão autônoma sobre aluno: ausente. O corte só leva a execução a `falhou IA_INDISPONIVEL`, sem modelo e sem gravar nada sobre o aluno. A pergunta cortada não conta no freio do dia. As métricas levam só `escola_id` (e `origem`).

Aprovação registrada: ok. A exceção da D47 continua só no Tutor. A `ferramenta` não tem corte e segue o fluxo dela.

Supervisão do tutor: há lacuna na AIA, que afirma ao professor uma visibilidade que o código não dá (bloqueante 1).

Autonomia declarada e visível: sim, sem mudança nesta tarefa.

Bloqueantes:

1. **`docs/aia/tutor.md:413`: a AIA afirma uma supervisão que não existe.** O texto diz "O professor continua vendo a pergunta sem resposta no resumo, como na falha do modelo". Não continua. As três leituras do professor excluem a pergunta cuja execução terminou `falhou`: `ultimasTrocas` (`apps/api/src/tutor/supervisao.repository.ts:240`), `trocasDeHoje` (`:288`) e `trocasDaTurmaNoMes` (`:307`), todas com `notExists(this.#execucaoQueFalhou())`. Nenhuma outra leitura de professor chega a `mensagem_tutor`. Quem vai mostrar ao professor as perguntas sem resposta é a 9.0, que está fora do escopo desta tarefa. A AIA é peça do dossiê que a escola recebe (D60, D61; regra 70, itens 4 e 6a).
   - **Correção exigida:** reescrever a frase com o que é verdade hoje. A pergunta fica em `mensagem_tutor`, mas não aparece ao professor (nem na última troca, nem nas contagens) até a 9.0. Citar a 9.0 como a tarefa que fecha isso.

2. **`docs/aia/tutor.md:410-412`, `docs/runbook.md:808` e `docs/runbook.md:829-830`: a cobertura da D36 no turno cortado está escrita maior do que é.** Os três trechos dizem que a mensagem fixa "não espera vaga" e que "o aluno continua recebendo o 188". Isso só vale para a leitura por palavras, que roda no `POST` (`apps/api/src/tutor/tutor.service.ts:101`). A AIA descreve, no item 10 (`docs/aia/tutor.md:101-109`), duas leituras que somam, e a segunda é a do modelo (`turno.command.ts:246-247`, `antesDeConcluir`). Ela só existe quando o modelo roda, e o corte impede justamente isso (`execucao.repository.ts:90`). No turno cortado, uma frase indireta sobre risco à vida que a lista de palavras não pega não recebe o 188. O professor também não recebe o sinal `atencao_humana` e, pelo bloqueante 1, nem vê a pergunta. É a hora de pico (10h de segunda) em que o corte mais acontece.
   - **Correção exigida:** no item 15 da AIA, dizer com todas as letras que no turno cortado só vale a leitura por palavras, e que a leitura do modelo (item 10) não acontece. Registrar isso como limitação, com o risco residual, pela D36. Nas duas entradas do runbook, trocar "o aluno continua recebendo o 188" por "a leitura por palavras da D36 continua; a do modelo não roda nas perguntas cortadas".

Recomendações:

- `apps/web/src/areas/aluno/tutor.ts:146`, `e2e/aluno-tutor.spec.ts:426` e `docs/interface.md:2296` descrevem uma sequência que não acontece: "o worker a grava mesmo com a execução... cortada pela espera" e "ela nunca espera vaga". O corte só pega execução `pendente`. Quando o worker grava a mensagem fixa, a execução já passou a `rodando` e não pode mais ser cortada. Além disso, a mensagem que o modelo classifica espera vaga, sim.
  - O estado "mensagem fixa e falha juntas" existe de verdade, mas por outro caminho: o modelo classifica `assunto_delicado` e depois a conclusão falha (varredura, prazo).
  - A mudança em `pendenteNoTutor` está certa para esse caso. Basta corrigir a causa nos comentários e no texto, para ninguém se apoiar nela depois.
- No e2e, o texto "sofro bullying na escola" provavelmente cai na leitura por palavras. Nesse caminho a execução termina `concluida` no próprio `POST` e nunca falha. Usar uma frase que só o modelo classificaria deixaria o cenário simulado coerente com a causa real.
- Fotos da tela, que mostram só o estado vazio e o inicial porque a vitrine não alcança a execução cortada:
  - em `aluno--aluno-tutor--Cinemática-lista-sintética--computador.png` e `--celular.png`, a tela se apresenta como IA ("Ele é uma inteligência artificial e pode errar") e avisa da supervisão;
  - nas mesmas fotos, `Hoje: 0 de 60 perguntas` é salvaguarda, não induz uso;
  - não aparece vocabulário de nota.
  - Nada a apontar pela regra 70. O estado cortado foi conferido pelo código e pelos testes: texto de sempre, sem código cru, sem vermelho, mensagem fixa acima do botão.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/interface.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/turno.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/tutor.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/tutor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/aluno-tutor.spec.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-16 06:56:23 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** a pergunta com 21 s é cortada pelo processador, e a cortada pelo `GET` também. Nos dois casos termina `falhou IA_INDISPONIVEL`, sem chamar o modelo, sem linha em `consumo_ia` e com a métrica +1.
- **Controles:** a pergunta com 15 s roda pelo processador. O `GET` aos 15 s não escreve nada.
- **Bordas:** o `GET` sobre `concluida` e sobre `rodando` com mais de 20 s; a `ferramenta` com 21 s, pelo processador e pelo `GET`; o job entregue duas vezes; a consulta seguinte, já cortada; o Redis fora e de volta; a troca (a cortada não conta, a reenviada conta); a D36 junto com o "Tentar de novo".
- **Concorrência:** as duas ordens forçadas da corrida, com barreira no banco.
- **Permissão e isolamento:** o `GET` de usuário da B, de outro aluno da mesma escola e de id inexistente; o job da A com a execução da B; o repository no contexto da A e no da B.
- **Métrica, alerta, log e tela:** a métrica só com escola; o alerta que separa uma escola de várias; o log só com ids; a tela em 1366 e 360 px.

**Cobertos:** todas as linhas da tabela têm caso citado pelo nome em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/corte-da-espera.int.test.ts`, em `apps/web/src/areas/aluno/Tutor.test.tsx`, em `apps/web/src/areas/aluno/tutor.test.ts`, em `e2e/aluno-tutor.spec.ts` e nos testes de infra e de guarda.
- **Execução:** rodei a primeira parte do arquivo de integração (`-t "o corte da espera"`): 17 passaram, e o pulado é o caso do Redis, que deixei de fora de propósito. Não rodei o caso do Redis porque ele para o `redis-fila`, que os outros revisores usam ao mesmo tempo.
- **Mutações:** os 55 blocos conferem com o `git diff`. Os termos sem bloco têm o motivo escrito e o motivo se sustenta.
- **Corridas:** as duas são concorrência de verdade, com `WriteBlockTrigger` e `esperarNaTrava`. Conferi que o `esperarNaTrava(…, 2)` conta a sessão parada no gatilho mais a sessão parada no `update`, então a barreira fica entre a leitura e o `update`.
- **IA:** só adaptador falso (`fila.falso()`).
- **Proibidos:** nenhum `.skip`, `.only` ou teste comentado.
- **Tela:** a mutação `mensagens.at(-1)` é pega pelo `getByText(PERGUNTA)`, que falha quando a pergunta aparece duas vezes, e no e2e pelo `toHaveCount(1)`.

**Bloqueantes:**

1. **O caso "Redis fora e de volta" só passa com a máquina folgada.** Arquivo: `apps/api/src/ia/corte-da-espera.int.test.ts:519–536`.
   - A execução `aos15` nasce com 15 s (linha 519). Antes de o job chegar (linha 533), o teste ainda espera:
     - parar o `redis-fila` (linha 523);
     - fazer três `GET`;
     - subir o Redis de novo (linha 529);
     - esperar o `aguardarSaudavel` (linha 530). O healthcheck do `redis-fila` em `infra/compose.yml` tem `interval: 2s`, então a primeira checagem só sai 2 s depois de o contêiner subir, e o `aguardarSaudavel` consulta o `compose ps` a cada 500 ms.
   - Somando três chamadas do Docker Compose e esses 2 s, sobram de 0 a 1 s dos 5 s de folga, numa máquina rápida.
   - Na esteira, ou com o Docker lento, a `aos15` passa de 20 s quando o job chega. O `marcarRodando(id, 20)` então não a marca, o processador corta, e o teste falha por tempo, não pela regra: `chamadas()` dá 1 em vez de 2, `aos15` fica `falhou` e a métrica dá +2.
   - **Correção exigida:** a idade de chegada tem de vir do banco, não do tempo que o Docker levou. Logo antes do `entregarDeNovo(aos15)`, depois de o Redis voltar, recue `criada_em` da `aos15` para `now() - 15 s`. Outra saída é semear a `aos15` com idade baixa e só depois recuá-la para 15 s. Se quiser, confira antes do `entregarDeNovo` que a idade no banco está abaixo de 20 s.

**Recomendações:**
1. **Alerta testado só pelo texto.** A separação "uma escola / várias escolas" só é provada pela igualdade de texto da expressão em `infra/test/alertas.test.ts:532–546`. Os blocos do limiar, do `== 1` e do `offset` ficam vermelhos só porque o texto muda: se a expressão estivesse semanticamente errada, o teste continuaria verde. Já existe o padrão de prova por comportamento (`infra/test/alertas.int.test.ts` e os `alerta-do-*.int.test.ts`). Vale um caso com séries sintéticas: uma escola com 3 cortes (dispara "uma escola"), duas escolas com 3 (dispara "várias" e não "uma"), uma com 2 (nada) e a série que acabou de nascer.
2. **Bloco que falta (corte antes da leitura).** A tabela e o `cenarios.md` §6 prometem a mutação "cortar antes da leitura" no isolamento do `GET`, e não há bloco para ela. O caso pega a mutação pelo `outroAluno`, da mesma escola, mas o bloco deveria existir.
3. **Bloco que falta (varredura).** A autoconferência (item 1) diz que "a contagem antes da gravação" da varredura tem bloco, e não tem: só há o da origem e o do `void encerradas`. Vale um bloco que leve o `interrompida` para dentro da transação, antes do `registrarEstimada`, citando "a gravação da linha falha".
4. **Axe que falta no e2e.** A tabela lista axe para o estado "mensagem fixa + Tentar de novo", mas o caso novo do e2e não roda axe e se apoia em outros dois casos. É a única vez que os dois blocos aparecem juntos: vale rodar `seriousViolations(page)` ali.
5. **Corrida não forçada.** O lado em que o processador ganha o `pendente → rodando` e o `update` do `GET` depois recebe zero linhas não tem caso forçado. A cláusula que protege é a mesma `estado = 'pendente'`, que já tem bloco, então fica como cobertura extra.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-16 07:32:55 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff da 2ª rodada não toca `Nota`, correção nem lançamento. Todos com autor humano? sim, porque nenhum caminho novo foi criado.
Decisão autônoma sobre aluno: ausente. O corte da espera encerra uma execução técnica (`falhou IA_INDISPONIVEL`). Não decide nada sobre a trajetória do aluno, e o texto da AIA diz isso.
Aprovação registrada: ok. A exceção da D47 continua só no Tutor. O próprio item 15 diz que o corte existe só nele ("a ferramenta espera sem limite").
Supervisão do tutor: há uma lacuna conhecida, agora declarada de forma correta. Ela não bloqueia esta tarefa. A pergunta cortada fica em `mensagem_tutor`, mas não aparece ao professor: as três leituras de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/supervisao.repository.ts` (linhas 240, 288 e 307, `notExists(this.#execucaoQueFalhou())`) a excluem. Isso fica até a 9.0. Está escrito na AIA e no `TODO.md`.
Autonomia declarada e visível: sim. Não mudou nesta rodada.

**Conferência das correções exigidas na 1ª rodada**

1. `docs/aia/tutor.md` (item 15, parágrafo "O professor, hoje, não vê a pergunta cortada"): **feita.** A frase falsa ("O professor continua vendo a pergunta sem resposta no resumo") saiu. No lugar está o que vale hoje: a pergunta fica em `mensagem_tutor`, as três leituras do professor a excluem, e a 9.0 vai mostrar a contagem sem o texto. Conferi contra o repository e está certo.
2. A cobertura da D36 no turno cortado: **feita nos três lugares.**
   - Na AIA, item 15, "Limitação, com o risco que sobra (D36)": diz que só vale a leitura por palavras, que roda no `POST`, e que a leitura do modelo não acontece. Registra o risco que sobra: uma frase indireta não recebe o 188 nesse turno e o professor não recebe o sinal `atencao_humana`.
   - No código, o `#encaminhar` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/tutor.service.ts:147` grava a mensagem fixa, o sinal e a conclusão numa transação, sem fila. O caminho do modelo, em `turno.command.ts:247` e `:273`, só existe quando o modelo roda. A limitação descrita bate com o código.
   - `docs/runbook.md:808` e `:829-830`: as duas trazem o texto exigido.
   - De quebra, a techspec §(2) e `docs/interface.md` também foram corrigidos, e o `TODO.md` ganhou uma entrada para avaliar o risco com a coordenação.

**Resto do diff, olhado pela regra 70**

- **Testes de tela e e2e** (`apps/web/src/areas/aluno/Tutor.test.tsx`, `tutor.test.ts`, `e2e/aluno-tutor.spec.ts`): o caso "D36 junto" agora usa o caminho que existe de fato (`EXECUCAO_INTERROMPIDA`, pela varredura). A frase usada não casa com nenhum gatilho da regra por palavras. O e2e voltou a checar acessibilidade (axe) e continua checando `VOCABULARIO_DE_NOTA`.
- **Comentário em `apps/web/src/areas/aluno/tutor.ts`**: corrigido e coerente com o código.
- **`docs/runbook.md:821`**: o registro no `TODO.md` deixou de levar o id da escola, porque o repositório é público. Para a minha regra é neutro e está certo.
- Não encontrei inferência emocional, métrica sobre o professor nem campo de nota em discursiva ou redação.

Bloqueantes: nenhum.

Recomendações:
- `docs/aia/tutor.md:408` ("A pergunta do Tutor que fica mais de 20 s `pendente`..."): a numeração da lista ficou 13, 15, 14. Vale renumerar ou mover o item 15 para depois do 14.
- `docs/aia/tutor.md:410`: "leitura por palavras do item 10" é ambíguo. O arquivo tem dois itens 10 (linha 98, a D36, e linha 389, a política "livre"), e o item 15 está na lista em que o 10 é o da política "livre". Indicar a etapa ou a seção da linha 98.
- A lacuna da supervisão até a 9.0 já está no `TODO.md`. Na 9.0, conferir que a contagem do professor inclui `falhou IA_INDISPONIVEL` sem o texto da pergunta. Pela regra 70, item 7, a contagem tem de ser sobre a dificuldade de usar o Tutor, sem virar indicador por aluno.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-16 07:33:08 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nesta rodada. O diff não toca migration nem schema. `execucao_agente` (que tem `escola_id`, ids UUID) só aparece no `update` de `criada_em` que o teste faz por id.
Queries verificadas: nenhuma query de produção mudou. As consultas que esta rodada envolve continuam iguais à rodada aprovada:
- `ExecucoesService.ler` lê primeiro no escopo de quem pediu (`deQuemPediu`) e só depois chama `cortarEspera`, cujo `where` usa o `escola_id` do contexto.
- O `update ... set criada_em` está só em `apps/api/src/ia/corte-da-espera.int.test.ts`, no caso do Redis, e altera a linha semeada por id.
- Em `apps/web/src/areas/aluno/tutor.ts` só mudou um comentário.

Teste de isolamento: presente e efetivo.
- "isolamento, job" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/corte-da-espera.int.test.ts:233`) prova a cláusula de escola do `cortarEspera`. Sem essa cláusula, a execução da B seria cortada e o caso quebraria.
- "isolamento: o GET de usuário da B" (linha 312) ganhou nesta rodada a mutação que move o `cortarEspera` para antes do `deQuemPediu`. Ela é pega porque o caso inclui um usuário da mesma escola: no escopo dele o corte grava, e o teste exige que nada seja escrito e nada seja somado. Também segue provado o 404 igual ao do id inexistente.
- O comentário que a rodada 1 pediu foi colocado na linha 313 e aponta para um caso que existe.

Correções exigidas na rodada anterior: nenhuma, porque ela foi aprovada sem bloqueantes. Das recomendações:
- O `anoLetivoId` nos `update` de `cortarEspera` e `marcarRodando` foi registrado no `TODO.md`.
- O comentário no caso do `GET` foi feito.

Bloqueantes: nenhum.

Recomendações:
- Continua aberta a recomendação da 1ª rodada: colocar `anoLetivoId` no `where` de `cortarEspera` e `marcarRodando` (`apps/api/src/ia/execucao.repository.ts`). Hoje está só no `TODO.md`. Convém fechá-la antes de outra tarefa passar a usar esses métodos.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-16 07:33:17 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Só auditei o diff `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/ordens/diff-7-r2.patch` e o que ele afeta. O que já estava aprovado e não mudou não foi reauditado.

**Campos pessoais tocados:** nenhum campo novo. O diff mexe em documentos (AIA do Tutor, `docs/interface.md`, `docs/runbook.md`, techspec, a tarefa, `TODO.md`), em testes (`Tutor.test.tsx`, `tutor.test.ts`, `e2e/aluno-tutor.spec.ts`, `corte-da-espera.int.test.ts`) e num comentário de `apps/web/src/areas/aluno/tutor.ts`. Não há migration, DTO, repository nem rota nova.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok. O caso de isolamento do `GET` (`apps/api/src/ia/corte-da-espera.int.test.ts:312`) só ganhou um comentário, que diz qual caso prova a cláusula de escola do `cortarEspera`. A tarefa ganhou uma mutação nova (`7_task.md`, bloco sobre `execucoes.service.ts`): ela põe o `cortarEspera` antes do `deQuemPediu` e exige que o caso de isolamento fique vermelho. Isso reforça a prova de que o id de outra escola ou de outra pessoa responde 404 antes de qualquer escrita.

**Logs:** limpos. O diff não acrescenta nenhum log. O runbook continua dizendo que o log do corte leva só `tipo`, `codigo`, `escolaId` e `execucaoId`, nunca o texto da pergunta.

**Auditoria:** nenhuma ação nova que a exija. O diff não tem leitura por coordenação ou rede, nem exportação, nota ou permissão.

**Envio externo:** nenhum novo. O turno cortado continua sem chamar o modelo e sem consumo.

**Seed/fixture:** sintético. As frases novas dos testes ("lá em casa as coisas estão bem complicadas") e os UUIDs fixos são inventados. No e2e, o aluno e o colega vêm de `criarAlunoComMatricula`. Mudou só a hora em que o colega é criado: agora ele é criado só no caso que prova que a tela não o mostra.

**Correções exigidas da rodada anterior:** a 1ª rodada não teve bloqueante, então não havia correção exigida. As duas recomendações dela foram tratadas:
- **Runbook sem id de escola no `TODO.md`:** feita, em `docs/runbook.md:821`: "a hora e quantos cortes, só com contagens, sem id de escola: o repositório é público".
- **Variante do `cortarEspera` para o `GET`, com `solicitadaPor` e `anoLetivoId` no `where`:** registrada em `TODO.md:3725` e na tabela de destinos de `7_task.md`, com o motivo. O motivo vale: o único chamador lê antes, no escopo de quem pediu, e o id é UUID.

**Bloqueantes:** nenhum.

**Recomendações:**
- `docs/aia/tutor.md`, item 15, agora diz que o professor não vê a pergunta cortada até a tarefa 9.0, e que nesse turno a leitura do modelo da D36 não roda. Para a regra 20, a mudança é neutra ou melhor: menos conteúdo de conversa circula. Mas o ponto é de supervisão e de D36, e o veredito sobre ele é do `conformidade-reviewer`. A 9.0 deve manter o que a AIA promete: mostrar a contagem sem o texto.
- Pergunta de fechamento: o diff não muda nada aqui. A execução cortada fica em `execucao_agente` com ids, sem `consumo_ia` e sem envio externo. O arquivo do titular continua respondendo o que se guarda e para onde foi.

**Fotos:** uso as da rodada anterior. Fora de teste, a única mudança em `apps/web` é um comentário em `apps/web/src/areas/aluno/tutor.ts:146-147`, que não muda o que a tela mostra.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 07:33:19 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As correções da 1ª rodada foram feitas. Os comentários e títulos que falavam em corte da espera junto com a mensagem fixa agora apontam o caminho real: o modelo classifica o assunto, a mensagem fixa é gravada, e a varredura encerra a execução como `EXECUCAO_INTERROMPIDA`. Isso vale em `tutor.ts:146-147`, `tutor.test.ts:172`, `Tutor.test.tsx:60-70`, `e2e/aluno-tutor.spec.ts:423`, `docs/interface.md:2293` e `techspec.md:128`. O que a `cenarios.md` §2 diz (linhas 91 e 93) bate com o que o código e os testes fazem agora.

O que mais mudou nesta rodada está certo:
- **AIA do Tutor, item 15:** registra a limitação que sobra. No turno cortado só vale a leitura por palavras da D36, e a pergunta cortada some da supervisão do professor até a 9.0. O `TODO.md` traz os dois pontos.
- **Runbook:** não pede mais o id da escola no `TODO.md`, porque o repositório é público. A frase de que "a D36 continua valendo" foi trocada pela descrição exata: a leitura por palavras continua, a do modelo não roda.
- **Teste de Redis fora e de volta:** a execução nasce com 5 s e a idade é reposta para 15 s no banco depois que o Redis volta. Isso tira a dependência do tempo que o Docker leva para parar e subir o contêiner. Os dois casos continuam provando o que diziam.
- **e2e:** a frase de teste não casa com nenhum gatilho da regra por palavras, o caso passou a rodar o axe, e os erros crus conferidos agora são os do `EXECUCAO_INTERROMPIDA`. Os ajudantes `trocar` e `responder` existem em `e2e/support/aluno.ts:68,159`.
- **Mutações:** os dois blocos novos, um para o `GET` cortando antes da leitura escopada e outro para a métrica da varredura dentro da transação, provam cláusulas que existem. A contagem do `--faltando` foi atualizada.
- **Recomendações da 1ª rodada:** as que não foram aplicadas estão em `TODO.md`, ou recusadas com motivo na tabela "Recomendações sem aplicar".

Recomendações:
- A seção "Revisões" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/7_task.md` sumiu numa edição do documento. Convém conferir se o hook a recria com o histórico real, que está em `achados/7_task.md`, e não como 1ª rodada, para a validação e a retro não lerem uma rodada a menos.
- Em `techspec.md:128`, o item (2) ficou com uma frase muito longa, com três ideias encadeadas: o `#encaminhar`, a mensagem que o modelo classifica e a limitação. Ficaria mais legível em frases separadas. É só texto.
- `e2e/aluno-tutor.spec.ts:284`: a docstring de `criarColega` explica o custo ("o prazo é curto"). Bastaria dizer o que a função faz.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/ordens/diff-7-r2.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/aluno-tutor.spec.ts

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-16 07:33:30 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO
Tela vista: sim (6 fotos lidas, computador e celular, escola cheia e vazia, mais a conversa da atividade). O estado cortado, com "Tentar de novo", não aparece na vitrine; só o código e os testes o cobrem.
Estados: ok.
- Vazio: "Nenhuma atividade para pedir ajuda agora" explica o que fazer, e a conversa vazia convida a escrever a dúvida.
- Com dado: a lista de atividades e a conversa aparecem nas fotos.
- Falha: a mensagem calma com "Tentar de novo" tem teste (`apps/web/src/areas/aluno/Tutor.test.tsx`) e caso no e2e.
- Carregando: não mudou nesta tarefa.

Acessibilidade: ok.
- O e2e do caso da mensagem fixa da D36 agora roda axe (`e2e/aluno-tutor.spec.ts`, depois de `paginaNaoRola`) e confere que o botão tem pelo menos 44 px.
- A mensagem fixa com o 188 fica acima do botão, e a ordem é conferida pela posição das caixas.

Chromebook fraco: sem mudança de peso. O diff da web fora de teste é um comentário em `apps/web/src/areas/aluno/tutor.ts:146-147`.

Celular:
- As fotos a 360 px não mostram rolagem horizontal nem texto cortado.
- A navegação de baixo e os cartões estão legíveis, e a caixa de pergunta é larga.
- O e2e mantém o 44 px do botão e a ausência de rolagem nas duas larguras.
- `Rolam a 1366 × 768: nenhuma`.

Ação oficial protegida: sim. A tela não tem ação oficial. O corte só encerra a execução como `falhou` e não chama o modelo, e o aluno não recebe resposta inventada.

Conferência das correções da rodada anterior:
- Eram duas recomendações, recusadas com motivo na tabela da `7_task.md`: citar o `min-h-11` no `docs/interface.md` e corrigir a lista de arquivos previstos. Nenhuma bloqueia.
- Fotografar o estado cortado fica para o Validador, como já estava registrado.
- O texto da `docs/interface.md` e o teste foram corrigidos. A D36 junto da falha é agora o caso `EXECUCAO_INTERROMPIDA`, não o corte da espera, que só pega a execução `pendente`.
- Isso bate com o código: `EXECUCAO_INTERROMPIDA` está na lista de falhas com nova tentativa (`packages/shared/src/tutor/passageiros.ts:19`), e o e2e usa `api.trocar` (`e2e/support/aluno.ts:68`), que existe.
- Nenhum termo técnico vaza: o e2e confere que `EXECUCAO_INTERROMPIDA`, a mensagem crua do catálogo e o 503 não aparecem no corpo da página.

Bloqueantes: nenhum.

Recomendações:
- Fotografar na validação a pergunta cortada com "Tentar de novo" e a mensagem do 188 acima dele, a 360 px. A vitrine não chega a esse estado hoje.
- O limite que a `docs/aia/tutor.md` item 15 registra continua aberto: no turno cortado só a leitura por palavras da D36 vale, e o professor não vê a pergunta cortada até a 9.0. Está no `TODO.md`, e o `conformidade-reviewer` responde por ele.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-16 07:33:32 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor | fila | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- As três recomendações da 1ª rodada estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/TODO.md`, perto da linha 3721, todas com destino. São estas: trazer a idade já na primeira leitura do `GET` e só tentar o corte depois de 20 s; trocar `soma − soma offset 10m` por `increase` ou `resets()`, porque a conta atual não trata o contador que volta a zero; e criar um contador próprio para o corte em `infra/k6/justica-entre-escolas.js:282`, na `FASE=sala`, pela tarefa 11.0. Continuam sem prazo. Antes do piloto, convém fechar ao menos a do `GET`, porque a tela consulta de segundo em segundo.
- O caso "Redis fora e de volta", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/corte-da-espera.int.test.ts:520-552`, ficou correto e deixou de oscilar. A de 15 s nasce com 5 s e volta a ter 15 s por `update` depois que o Redis sobe, e isso bate com a decisão do processador, que lê a idade no banco. Mas o caso já não prova que o tempo em que o Redis ficou fora conta na idade. Ainda depende de o `docker stop` levar menos de cerca de 15 s; se levar mais, o caso falha de forma visível, sem passar em falso. Quem quiser provar o tempo parado pode fazer um caso à parte, que cria a execução antes do `stop` e confere o corte pela idade real.
- O caminho de degradação do turno cortado está mais honesto nos documentos (`docs/aia/tutor.md` item 15 e as duas entradas do `docs/runbook.md`): no turno cortado só a leitura por palavras da D36 roda, e o professor não vê a pergunta até a 9.0. Na hora de pico, o risco que sobra fica com quem é dono dele: a D36 está no `TODO.md` com `conformidade-reviewer`, e a supervisão vai para a 9.0.

O código de produção não mudou desde a rodada aprovada. A única alteração de produção no diff é um comentário em `apps/web/src/areas/aluno/tutor.ts`; o resto são testes e documentos. Não rodei o caso do Redis, para não parar o `redis-fila` debaixo de outro revisor.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 07:34:03 · `tasks/prd-reengenharia-continuacao/7_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada, todos ainda cobertos:
- Corte aos 21 s pelo processador e pelo `GET`.
- A execução de 15 s roda.
- A ferramenta não tem corte.
- O `GET` sobre a `concluida` e a `rodando` não escreve nada.
- Corrida entre o processador e o `GET`, com duas chamadas em paralelo e o gatilho que segura o corte.
- Isolamento pelo `GET`: usuário da B, outro aluno da mesma escola e id inexistente dão o mesmo 404.
- Isolamento pelo job, com o `execucaoId` da B.
- A pergunta cortada não conta como troca, e a reenviada conta.
- A métrica leva só `escola_id` e `origem`.
- Na varredura, o lote desfeito não conta.
- Redis de fila fora e de volta.
- Alerta e runbook.
- Na tela, a pergunta cortada mostra "Tentar de novo"; no caso D36, a mensagem fixa fica acima do botão; o e2e roda a 1366 e a 360 px.
- O log leva só ids.

**Cobertos:** todos, um teste por linha da tabela. Conferi a correção exigida e cada mudança do diff `diff-7-r2.patch`.

1. **A correção exigida está feita** (`apps/api/src/ia/corte-da-espera.int.test.ts:521` e `:534`). A `aos15` agora nasce com 5 s. Depois de o Redis voltar e logo antes do `entregarDeNovo(aos15)`, o teste recua `criada_em` para `now() - 15 s` com `update ... make_interval(secs => 15)`. A idade de chegada vem do banco e não depende mais do tempo que o Docker leva para parar e subir. Entre esse `update` e o `marcarRodando(id, 20)` passam milissegundos.
2. **O bloco "cortar antes da leitura"** (`execucoes.service.ts`) cai no caso "isolamento: o GET de usuário da B" pelo motivo certo. O `outroAluno` da escola A está no escopo A, então o `cortarEspera` sem `solicitadaPor` corta a linha da A, e a asserção `execucaoDe(id)).toEqual(lida)` da linha 327 fica vermelha. O pedido da B não alcança a linha pelo escopo, e o comentário novo da linha 313 diz isso, apontando para "isolamento, job" (linha 233), que tem o bloco da cláusula de escola (`7_task.md:146-152`).
3. **O bloco da contagem antes da gravação** (`varredura-de-execucoes.ts`) cai em "a gravação da linha falha" pelo motivo certo. Com a mutação, a soma acontece dentro da transação que `quebrarAGravacaoDa` desfaz, e a linha 483, `contagem(...)).toBe(antes)`, fica vermelha.
4. **O caso D36 mudou de enredo, e os testes acompanham.** Antes ele dizia "pergunta cortada com a mensagem fixa junto", agora diz "o modelo classificou o assunto e a varredura encerrou a execução, `EXECUCAO_INTERROMPIDA`". Os três testes foram ajustados: `tutor.test.ts`, `Tutor.test.tsx` e o e2e. A frase do aluno agora não casa com nenhum gatilho da regra por palavras, coerente com o caminho que o teste descreve. Rodei `npx vitest run apps/web/src/areas/aluno/tutor.test.ts` na raiz: 2 arquivos, 25 casos, verdes. `EXECUCAO_INTERROMPIDA` cai na aparência `fila`, que dá "Tentar de novo".
5. **O e2e ganhou o axe** (`e2e/aluno-tutor.spec.ts`): `seriousViolations(page)` é igual a `[]`. A lista do que não pode aparecer cru agora é a de `EXECUCAO_INTERROMPIDA`. Os métodos `trocar`, `responder` e `falharNoTutor` existem em `e2e/support/aluno.ts`.
6. **A tabela de testes e os blocos citam os títulos novos** (`7_task.md:54-55`, `:392`, `:401`), e a contagem diz 57 blocos.
7. **Nada de `.skip`, teste comentado ou chamada a provedor pago** no diff. O modelo segue o falso e contado (`modeloContado`).

Não rodei o caso do Redis, porque ele para o `redis-fila` e outros revisores rodam ao mesmo tempo. A leitura acima é só do código.

**Bloqueantes:** nenhum.

**Recomendações:**
- **Segundo ponto do caso do Redis que ainda depende do relógio** (`corte-da-espera.int.test.ts:527`). O `GET` feito com o Redis fora ainda espera ver a `aos15` `pendente`, o que pede que o `stop` mais os três `GET` levem menos de 15 s. Esse tempo tem limite: `infra/compose.yml` não declara `stop_grace_period`, então vale o padrão de 10 s e a idade fica em cerca de 16 s no pior caso. Para tirar o relógio também daqui, recuar `criada_em` da `aos15` para algo como 10 s logo depois do `composeAssincronoOuFalha('stop', ...)`, como já se faz antes da entrega.
- Os textos de `docs/aia/tutor.md` (item 15) e dos runbooks agora dizem que a leitura do modelo não roda no turno cortado. Nenhum teste prova essa ausência, que decorre de o modelo não ser chamado. O caso "processador corta" já conta zero chamadas, então basta citá-lo como a prova no item 15 da AIA.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/corte-da-espera.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/Tutor.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/aluno/tutor.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/aluno-tutor.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/7_task.md
