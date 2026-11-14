# Achados das revisões — `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-14 01:35:12 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta correção. `execucao_agente` só é lida por um método de repository que já existia.

Queries verificadas:
- `ExecucaoDaSessaoRepository.daChave` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/execucao.repository.ts:121-134`) filtra por `escolaId`, `anoLetivoId` e `solicitadaPor`, os três tirados do contexto do token, e não por argumento. É o mesmo filtro que o `agendar` já usa.
- Os pontos que passaram a usar esse método:
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/artefato/ferramentas.service.ts:73`
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/assistente/assistente.service.ts:91`
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/tutor/tutor.service.ts:181`
- Nos três, o desvio só pula o filtro de material, e só quando a chave é desta pessoa e a tarefa é a mesma do pedido. A conferência de turma e disciplina (`turmaComDisciplina` e `#alcance`) continua antes do desvio. Nenhum endpoint passou a aceitar `escolaId` vindo do cliente.
- O desvio não cria execução nova. Mesmo com `reenvio=true`, o `gravarPendente` bate no índice único `(escolaId, chaveEnvio)` e devolve a linha que já existe.
- A chave de outra escola não é achada pelo `daChave` e também não conflita no índice, que é por escola.
- A chave de uma colega da mesma escola continua recebendo a mesma recusa (`422 SEM_MATERIAL_DA_SERIE`) que uma chave nova receberia. Então nada novo revela que a execução existe.
- Nenhum `@Unscoped()` novo. Ids continuam UUID. A correção não toca na camada de rede.

Teste de isolamento: presente e efetivo. É o caso `a chave aceita para uma professora não abre a recusa para outra da mesma escola` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/leitura-por-serie.int.test.ts`, no grupo novo). Se a cláusula `solicitadaPor` sair do `daChave`, o reenvio da colega passa a ser tratado como dela, o `agendar` devolve `202` com o id da outra professora, e o teste quebra. O caso `a chave aceita para um pedido não pula a conferência de outro` cobre a troca de tarefa: ele quebra com as mutações `?.tarefa !== undefined` declaradas no documento.

Bloqueantes: nenhum.

Recomendações:
- Acrescentar um caso com professor da escola B reenviando a chave aceita da escola A depois que o material saiu. Ele deve receber a mesma resposta de uma chave nova. Hoje a cláusula `escolaId` do `daChave` só é provada pelos testes anteriores, não por este grupo novo.
- No Tutor, quando é reenvio, `alcance = daTurma` faz o `onde` ficar com `materialId` nulo. Isso não tem efeito, porque o `aoGravar` não roda no reenvio. Vale um comentário na linha 181 dizendo que o `onde` só é usado quando a execução é nova, para ninguém depender dele no reenvio.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-14 01:35:13 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A correção não mexe em `Nota`, correção, lote nem seed. Todos com autor humano? Sim, nada mudou aqui.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. O reenvio da ferramenta e do chat devolve a execução já aceita. O artefato continua nascendo pendente pelo `aoConcluir` de sempre, que a correção não mexeu. Quando a chave já foi aceita, `agendar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/execucao.scheduler.ts:82-92`) não chama `aoGravar` e não cria saída nova.

Supervisão do tutor: ok. No reenvio só deixa de rodar a conferência de material na hora do pedido (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/tutor/tutor.service.ts:181`).
- Nenhuma mensagem nova é gravada, porque `aoGravar` não roda quando a chave se repete.
- A pergunta original continua em `mensagem_tutor`, visível ao professor como antes.
- Se a execução ainda estiver pendente, `entrada` confere o material de novo (`tutor.service.ts:211`). Fora do alcance, a execução falha sem trecho e sem chamar o modelo, então nenhuma resposta do Tutor sai sem a supervisão de sempre.
- Continuam valendo no reenvio: a D36, que chega antes; o `#alcance` (turma, atividade e questão); o limite de pedidos; a suspensão da função; e a trava de avaliação aberta, conferida em `entrada` e em `aoConcluir`.

Autonomia declarada e visível: sim, sem alteração. A correção não toca em governança nem no nível de autonomia dos agentes.

Bloqueantes: nenhum.

Itens 7 a 9 da lista conferidos: não há inferência emocional, nem campo de nota em discursiva ou redação (D46/D55), nem métrica de professor. O `daChave` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/execucao.repository.ts:121-134`) filtra por escola, ano letivo e `solicitadaPor`. Assim, a chave de uma pessoa não libera nada para outra, e o teste da colega da mesma escola prova isso. `docs/regulacao.md` não foi alterado, e a correção não pede que seja.

Recomendações:
- O teste do Tutor (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/leitura-por-serie.int.test.ts`, último caso do grupo novo) só reenvia execuções já concluídas. Vale um caso com a execução ainda pendente na hora do reenvio, para provar que o reenvio não produz resposta do Tutor e que a execução falha em `entrada` por causa do material. Hoje isso está garantido pelo código, mas nenhum teste deste grupo mostra.
- Falta um controle no Tutor igual ao da ferramenta: a chave aceita de um aluno, reenviada por outro aluno da mesma turma, continua recusada.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-14 01:35:18 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum. A correção não cria coluna, migration nem DTO, e não muda o que se grava. A resposta do reenvio continua sendo só `{ execucaoId }`.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok.
- `ExecucaoDaSessaoRepository.daChave` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/execucao.repository.ts:121-134`) filtra por escola, ano letivo, `chaveEnvio` e `solicitadaPor = requireUsuarioId()`, e esses valores vêm do token. Por isso a chave de outra pessoa não é achada, e a conferência de material continua valendo para ela. O teste `a chave aceita para uma professora não abre a recusa para outra da mesma escola` prova isso.
- O vínculo continua sendo conferido antes do atalho do reenvio: `turmaComDisciplina` na ferramenta e no chat, `#alcance` (turma, atividade, questão) no Tutor.
- A chave aceita para uma tarefa não abre outra: a ferramenta e o chat comparam `tarefa`, e o Tutor responde `CONFLITO`. O teste `a chave aceita para um pedido não pula a conferência de outro` guarda isso.
- Fiz a troca do `materialId` no corpo do Tutor. Com uma chave já aceita, a resposta é `202` com a execução que já existia, seja o material inexistente, de outra escola ou fora do alcance. Como a resposta é a mesma em todos os casos, ela não confirma a existência de nada (regra 20, item 6). Nesse ramo, o `onde` montado a partir de `daTurma` não chega a ser gravado: o `aoGravar` só roda quando a execução é nova (`execucao.scheduler.ts:82-86`).
- Se a execução ainda estava pendente quando chega o reenvio, ela volta a rodar, e a `entrada` do Tutor confere de novo turma e material a partir da pergunta gravada, não do corpo do reenvio (`tutor.service.ts`, na `entrada`).

**Logs:** limpos. Nenhum log novo nos três serviços.

**Auditoria:** a correção não cria nenhuma ação que a regra 20, item 10, obrigue a auditar. Não há leitura de dado de aluno por coordenação ou rede, nem exportação, nota, permissão ou aprovação.

**Envio externo:** nenhum novo. Nos dois testes de reenvio, o espião do `FakeAdapter` prova que o modelo não é chamado, e `gastos` prova que nada novo foi gravado em execução, consumo ou mensagens.

**Seed/fixture:** sintético. São textos genéricos ("explique o reagente limitante", "estequiometria"), ids gerados por `randomUUID()` e o cenário do próprio teste.

**Bloqueantes:** nenhum.

**Recomendações:**
- No Tutor, quem tem uma chave já aceita recebe `202` com qualquer `materialId` no corpo. Hoje isso não vaza nada, porque a resposta não muda. Vale um comentário em `tutor.service.ts`, ao lado do `jaAceita === undefined ? await this.#doMaterial(...) : daTurma`, dizendo que o ramo do reenvio não pode passar a devolver nada do material do corpo, para ninguém transformar isso em oráculo depois.
- Na ferramenta e no chat, o `daChave` antecipado lê fora da transação do `agendar`. Isso não é risco de privacidade, porque o `agendar` volta a decidir sob a transação. Fica registrado só para a revisão de infra, que é quem olha concorrência.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/artefato/ferramentas.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/assistente/assistente.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/tutor/tutor.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/leitura-por-serie.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/execucao.repository.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/execucao.scheduler.ts`, só lidos: são o escopo do `daChave` e a deduplicação do `agendar`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-14 01:35:31 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok

**Bloqueantes:** nenhum.

**O que conferi:**
- **Rate limit.** O reenvio continua passando pelo limite por pessoa e por escola. Na ferramenta e no chat, `limite.contar()` roda antes de tudo. No Tutor, roda depois do `#doMaterial`, e agora alcança também o reenvio, que antes saía com 404 sem passar por ele. Nenhuma checagem depende de IP.
- **Concorrência.** O `daChave` novo não grava nada. Ele só decide se a conferência de material roda. Quem grava continua sendo o `agendar`, protegido pelo índice único `execucao_agente_chave_na_escola_unica (escola_id, chave_envio)`, e o caso da chave de outra tarefa termina em `CONFLITO`. Clique duplo antes da primeira gravação: os dois envios passam pela conferência e o índice único grava um só. Sem corrida nova.
- **Índice.** A consulta extra por request na ferramenta e no chat é uma busca pontual pelo mesmo índice único. O Tutor já fazia essa consulta.
- **Testes.** Usam o `FakeAdapter`, sem provedor pago. Os três reenvios conferem que nada é gravado nem gasto e que o modelo não é chamado. A chave de outra tarefa e a de outra professora continuam recusadas.
- **Teste de carga.** Não precisa mudar: a carga por request é praticamente a mesma.
- **Métrica.** O contador `tutorRecusadoSemMaterial` deixa de contar o reenvio, o que está certo, porque o reenvio não é recusa nova.

**Recomendações:**
1. **Chat retomado sem material.** Arquivos: `apps/api/src/assistente/assistente.service.ts:106-121` e `apps/api/src/ia/execucao.scheduler.ts:96-97`. O reenvio de uma execução ainda `pendente` (o processo caiu antes de rodá-la) a retoma. Agora isso acontece também com o material fora do alcance. A ferramenta falha certo nesse caso (`MATERIAL_INSUFICIENTE`, em `ferramentas.service.ts:123`), e o Tutor também (o `#doMaterial` roda de novo no `entrada`). O `entrada` do chat não confere nada: busca trechos, recebe lista vazia e chama o modelo assim mesmo. A mesma falha já existia antes desta correção, para o material que sai entre o `202` e a execução rodar. Vale uma tarefa à parte: o `entrada` do chat deve recusar sem material da série (o mesmo erro `MATERIAL_INSUFICIENTE` da ferramenta), sem chamar o modelo.
2. **Consulta repetida no reenvio.** Arquivos: `apps/api/src/artefato/ferramentas.service.ts:73` e `apps/api/src/assistente/assistente.service.ts:91`. O `daChave` roda aqui e roda de novo dentro do `agendar` quando a chave já existe. Juntar as duas consultas é opcional. O custo é uma busca pontual.
3. **Ambiente do teste.** O documento registra que os workers do compose `educa-teste-2` disputavam a extração do PDF com a API do teste e derrubavam um caso já no HEAD. Vale isolar o teste de integração desses workers (outra fila ou outro prefixo no Redis), para a esteira não ficar instável.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-14 01:35:59 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Fica uma ressalva, que vai nas recomendações. A primeira conferência continua igual: ferramenta e chat recusam antes do `202`, e o Tutor confere o material depois da D36. A correção só deixa passar a chave que a mesma pessoa já teve aceita para a mesma tarefa, como o contrato da `chaveEnvio` já prometia. Ela vem do achado do `infra-guardian` na 9.0 e foi pedida pelo Orquestrador. Por isso não a trato como divergência decidida em silêncio.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

Recomendações:
1. **Registrar a exceção na Tech Spec e nos cenários.** Em `tasks/prd-ingestao-do-material/techspec.md:112-114` e `:117-123`, o texto diz que ferramenta e chat conferem antes do `202` e que o Tutor filtra o material e a série. Não diz que o reenvio da chave já aceita pula esse filtro. Na seção "Leitura de página por série (RF7, RF8)" de `tasks/prd-ingestao-do-material/cenarios.md`, falta o cenário do reenvio, com a chave nova ainda recusada como controle. Hoje essa regra está só no documento da correção.
2. **O chat continua sem a conferência depois do `202`.** Isto já existia antes desta correção. A correção diz, em `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md:54-60`, que quem decide o que o pedido vira é a execução. Isso vale para o Tutor, que confere de novo em `apps/api/src/tutor/tutor.service.ts:222`, e para a ferramenta, que falha com `MATERIAL_INSUFICIENTE` em `apps/api/src/artefato/ferramentas.service.ts:123`. Não vale para o chat. Em `apps/api/src/assistente/assistente.service.ts:121`, se o material sai entre o `202` e a execução rodar, a busca devolve uma lista vazia e o modelo é chamado mesmo assim, sem trecho nenhum. Os testes novos só reenviam execuções já terminadas, então não passam por isso. Vale uma correção própria: no `entrada` do chat, falhar com `SEM_MATERIAL_DA_SERIE` quando `existeMaterialDaSerie` for falso, como o Tutor já faz.
3. **A mesma consulta aparece em dois lugares.** A linha que procura a chave já aceita é a mesma em `apps/api/src/artefato/ferramentas.service.ts:73` e em `apps/api/src/assistente/assistente.service.ts:91`, com o mesmo comentário longo. Um método no `ExecucaoDaSessaoRepository`, por exemplo `jaAceita(chaveEnvio, tarefa)`, deixaria o motivo num lugar só. Também evitaria que um terceiro serviço copie a comparação de um jeito diferente.
4. **Uma consulta a mais por pedido.** Toda geração e toda mensagem de chat agora fazem uma leitura em `execucao_agente` (`daChave`) antes do `agendar`, e o `agendar` lê de novo quando a chave já existe. A leitura é por escola, ano e chave, então deve usar o índice único. O impacto parece pequeno, mas quem confirma é o `infra-guardian`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-14 01:36:35 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** a ferramenta (atividade e plano), o chat e o Tutor reenviam a chave já aceita depois que o material saiu, e recebem o mesmo `execucaoId`, sem gravar nada, sem consumo e sem chamar o modelo.
- **Borda: a chave nova.** Com o mesmo corpo, ela continua recusada.
- **Borda: a chave de outro pedido.** Reaproveitada em outra ferramenta ou no chat, ela não pula a conferência.
- **Borda: a execução ainda pendente.** É a queda no meio: o processo caiu antes de rodar, ou o reenvio chega antes do worker. O reenvio a retoma (`execucao.scheduler.ts:96-98`), e o material saiu entre o `202` e esse momento.
- **Permissão:** outra professora da mesma escola, com a mesma chave e o mesmo corpo, continua recebendo `SEM_MATERIAL_DA_SERIE`.
- **Isolamento:** a chave só é achada no escopo de escola, ano e pessoa (`daChave`).
- **Concorrência:** clique duplo com a mesma chave. Não muda com esta correção, porque o índice único continua decidindo no `gravarPendente`.

**Cobertos:**
- Caminho feliz da ferramenta e do chat: `a ferramenta e o chat devolvem o execucaoId já aceito…`.
- Caminho feliz do Tutor, com o material aberto (`NAO_ENCONTRADO`) e com o da série (`SEM_MATERIAL_DA_SERIE`): `o Tutor devolve a execução já aceita…`.
- Chave nova recusada: dentro desses dois testes.
- Chave de outro pedido: `a chave aceita para um pedido não pula a conferência de outro…`.
- Permissão: `a chave aceita para uma professora não abre a recusa para outra…`.
- Os quatro testes que a tabela do documento cita existem com esses nomes.
- Há asserções sobre o resultado: o mesmo id, nada novo em `execucao_agente`, `consumo_ia`, `mensagem_agente` e `mensagem_tutor`, e o espião do `FakeAdapter` sem chamada. Não usa provedor pago.
- Toda cláusula nova tem bloco de mutação: as duas comparações com a tarefa (`!==` tarefa e `!== undefined`) e o `!reenvio &&` nos dois serviços, mais o ternário do Tutor. O `--faltando` dá 0.
- Não há `.skip` nem teste comentado.

**Bloqueantes:**

1. **O reenvio de execução pendente, depois que o material saiu, não tem teste, e no chat o modelo é chamado sem material.**
   - **Onde:** `apps/api/src/assistente/assistente.service.ts:91-93`, `apps/api/src/artefato/ferramentas.service.ts:72-75` e `apps/api/test/leitura-por-serie.int.test.ts:339-430`.
   - **O que muda:** com a correção, o reenvio da chave aceita pula o `existeMaterialDaSerie` e chega ao `agendar`. Quando a execução ainda está `pendente`, o `agendar` a retoma (`apps/api/src/ia/execucao.scheduler.ts:96-98`). Antes, esse reenvio parava no `422`, antes do `agendar`.
   - **Por que o teste não vê:** os quatro testes novos só reenviam depois de a execução estar `concluida` (`aceitarETerminar`). Nesse caso o executor não roda de novo, e por isso "o adaptador não foi chamado" passa sem provar nada sobre o caminho que a correção abriu.
   - **O que acontece no caminho aberto:**
     - **Chat:** o `entrada` (`assistente.service.ts:106-129`) confere o vínculo e chama `trechos.buscar`, mas não recusa quando o resultado vem vazio. O schema da tarefa aceita `trechos: []` (`packages/core/src/ia/tasks/propor-ferramenta.ts:24`). Pela leitura do código, o modelo é chamado sem nenhum trecho e o consumo é gravado, o contrário do RF8 que o próprio comentário da linha 92 declara ("nada é gravado nem gasto").
     - **Ferramenta:** o `#preparar` lança `MATERIAL_INSUFICIENTE` antes do modelo (`ferramentas.service.ts:123`). Funciona, mas nenhum teste prova isso.
     - **Tutor:** já tem os testes `[P]` com `mudandoEntreO202EAExecucao`.
   - **O documento:** "O material que saiu do alcance depois do `202` falha a **execução**" só vale para o Tutor, e o texto não diz isso dos outros dois.
   - **Correção exigida:**
     - Um teste para a ferramenta (atividade e plano) e para o chat, no padrão de `mudandoEntreO202EAExecucao` (`leitura-por-serie.int.test.ts:~480-504`): a execução fica gravada e não roda, o material sai, e o reenvio com a mesma chave a retoma.
     - O teste confere quatro coisas: `202` com o mesmo id, execução `falhou` com o código, `FakeAdapter.chamar` sem chamada e `consumo_ia` zero para aquela execução.
     - No chat esse teste deve ficar vermelho hoje. Isso exige a conferência no `entrada` (por exemplo, falhar com `SEM_MATERIAL_DA_SERIE` quando não há material da série), ou que o reenvio só pule o filtro quando a execução já terminou.
     - Esse ramo novo leva também o seu bloco de mutação.

**Recomendações:**
- O teste do Tutor (`leitura-por-serie.int.test.ts:~423`) confere a chave nova com `toMatchObject({ codigo })`. Vale conferir também o `status`, como fazem os testes da ferramenta e do chat.
- O Tutor não tem um caso de outro aluno da mesma turma reenviando a mesma chave. O escopo por pessoa vem do `daChave` e já está provado pelo teste da professora; o caso do aluno seria cobertura extra.
- O documento registra que os trabalhadores do compose `educa-teste-2` disputavam a extração do PDF e derrubavam um caso antigo do arquivo. Vale registrar no `TODO.md` ou na retro, porque o teste depende de nenhum worker de fora estar de pé.
- Não consegui rodar o teste: `npx vitest run test/leitura-por-serie.int.test.ts` falhou ao carregar (`Failed to resolve entry for package "@educa/core"`, o pacote não está compilado nesta árvore). Não compilei para não alterar arquivos. O vermelho e o verde que o documento relata ficam pela prova do portão.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/assistente/assistente.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/artefato/ferramentas.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ia/execucao.scheduler.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/leitura-por-serie.int.test.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-14 01:49:13 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

Caminho quente tocado: IA (o `entrada` do chat, que roda na fila interativa)
Rate limit: ok (não mudou nesta rodada: o reenvio continua passando pelo teto por pessoa e por escola)
Fila e prioridade: ok (a conferência nova roda dentro do job interativo que já existia, antes do modelo; o request não ganhou trabalho)
Concorrência: protegida. A execução pendente retomada pelo reenvio agora confere o material de novo, e o teste prova isso. Ele segura a execução em `rodando` com o gatilho do banco de teste e confere: o mesmo `execucaoId`, a execução `falhou`, uma única execução por `chave_envio`, nenhum consumo e o modelo não chamado. Esses testes estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/leitura-por-serie.int.test.ts`, de `reenviandoComAExecucaoPendente` em diante.
Índice e paginação: ok. `existeMaterialDaSerie` é a mesma consulta que o request já fazia em `assistente.service.ts:93` e `ferramentas.service.ts:75`. Não há consulta nova: é uma leitura a mais por execução de chat, e ela passa antes da chamada ao modelo.
Degradação de IA: ok. Quando o material saiu, a execução falha com o erro tipado `SEM_MATERIAL_DA_SERIE`, sem chamar o modelo e sem consumo, pelo mesmo caminho que a ferramenta (`MATERIAL_INSUFICIENTE`) e o Tutor (`NAO_ENCONTRADO`) já usam.
Migration: não se aplica
Métrica e alerta: ok (a falha passa pelo caminho de execução falhada que já existia; não há alerta novo)
Bloqueantes: nenhum

A recomendação da rodada 1 sobre o `entrada` do chat foi atendida em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/assistente/assistente.service.ts:115`. O teste da execução pendente cobre o caso, e dois blocos de mutação desta linha estão no documento da correção.

Recomendações:
- No `entrada` do chat, a resposta agora espera duas consultas seguidas ao material da série: `existeMaterialDaSerie` e depois `trechos.buscar`. Se o tempo do chat no p95 subir na manhã de segunda, juntar as duas fica para tarefa futura: `buscar` vazio, com a série sem material, já seria o sinal. Hoje o custo é desprezível.
- O comentário novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/tutor/tutor.service.ts:181` diz que o reenvio não pode virar oráculo do material que existe. Os dois testes de isolamento novos protegem isso: um com o colega da mesma turma, outro com a professora da escola B. Vale manter os dois juntos se o arquivo for dividido.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-14 01:49:25 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A rodada só acrescenta uma conferência de existência de material no `entrada` do chat e um comentário no Tutor. Nenhuma coluna, DTO ou payload novo. O que a falha grava em `execucao_agente.erro` é só o código (`SEM_MATERIAL_DA_SERIE`), como o teste confere em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/leitura-por-serie.int.test.ts:101`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/assistente/assistente.service.ts:115`, a conferência nova vem depois do vínculo, na linha 114. Ela usa a `turma` e a `pergunta` relidas do banco, não o corpo do pedido, e passa pela mesma `existeMaterialDaSerie` (`trecho-search.ts:64`) já usada antes do `202`, na linha 93.
- Os testes novos fazem a troca de id que pedi: a chave de um aluno usada por um colega da mesma turma (linhas 126-148) e a chave da escola A usada pela professora da escola B (linhas 150-166). O teste confere que `status` e `codigo` são **idênticos** com a chave aceita e com a chave nova (`toEqual`, que substituiu o `toMatchObject` na linha 77). A chave aceita não serve para descobrir se o pedido existe.
- O comentário que eu recomendei na rodada 1 está em `tutor.service.ts:181`.

Logs: limpos. Nada de log foi acrescentado. A exceção carrega só o código tipado.

Auditoria: presente onde a regra exige. A rodada não toca em leitura por coordenação ou rede, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: a rodada reduz o envio. Antes, o chat chamava o modelo sem trecho de material quando o material saía depois do `202` (a correção registra que o caso foi visto vermelho). Agora a execução falha antes do modelo, e o teste confere que não houve chamada nem consumo (linhas 102-103). Nada novo vai para fora, e o registro em `ExecucaoAgente` não mudou.

Seed/fixture: sintético. A cena é montada pelos helpers do teste (`cenario`, `novoAluno`, `montarEscolaComAssistente`), e o único texto do aluno é "não entendi o reagente limitante".

Pergunta de fechamento: inalterada nesta rodada. O que a execução falha guarda já estava no mapa do titular, e nada novo vai para fora.

Bloqueantes: nenhum.

Recomendações:
- O comentário em `assistente.service.ts:114-115` repete o que o documento da correção explica. Dá para encurtá-lo para uma linha, sem prejuízo.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-14 01:49:27 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

**Tabelas verificadas:** nenhuma nova. O diff não traz migration.

**Queries verificadas:**
- `assistente.service.ts:115`: a nova conferência no `entrada` usa o mesmo `TrechoSearch.existeMaterialDaSerie` do `enviar`. Ele chama `MaterialRepository.existeMaterialDaSerie` (`apps/api/src/material/material.repository.ts:447`), que filtra por `eq(material.escolaId, requireEscolaId())`, ou seja, a escola vem do contexto e não de parâmetro. O `serieId` vem da turma lida por `TurmaDoProfessorRepository.turmaComDisciplina`, que tem escopo. A `disciplinaId` vem da pergunta gravada, achada pela chave dentro do escopo. Nenhum valor do corpo decide o escopo.
- `tutor.service.ts`: a mudança é só um comentário. O ramo do reenvio não passou a devolver nada do material, só o `execucaoId` que já era da pessoa.
- Nenhum endpoint passou a aceitar `escolaId` no corpo ou na query.
- A árvore de trabalho em `apps` é igual à árvore `07d48763`.

**Teste de isolamento:** presente e efetivo.
- O caso novo em que a escola B reenvia a chave aceita pela A (`apps/api/test/leitura-por-serie.int.test.ts`, "a chave aceita na escola A não abre a recusa para a professora da escola B") quebra se o escopo for tirado do `daChave`. Sem escopo, o reenvio seria tratado como da B, a conferência de material seria pulada e a B receberia `202` em vez de `422`. A resposta da chave reaproveitada é comparada por `toEqual` com a da chave nova, o que fecha a regra 6: a resposta não confirma que a chave existe.
- O caso do colega da mesma turma prova que a chave é de quem pediu, dentro da mesma escola.
- Os casos de execução pendente quebram sem a nova linha 115: as duas mutações registradas na correção derrubam o caso do chat.

**Correções exigidas na rodada anterior:** nenhuma. As duas recomendações que eram minhas foram aplicadas: o caso da escola B e o comentário no ramo do reenvio do Tutor (`tutor.service.ts:181`).

**Bloqueantes:** nenhum.

**Recomendações:**
- No caso da escola B, o material da A também é apagado antes do reenvio. Isso não enfraquece a prova, mas deixar o material da A presente mostraria que a recusa vem da série da B e não de não haver material em escola nenhuma. É uma melhoria, não bloqueia.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/assistente/assistente.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/tutor/tutor.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/material/material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/leitura-por-serie.int.test.ts

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-14 01:49:30 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não toca `Nota`, correção nem lançamento: muda só a conferência de material no `entrada` do chat, um comentário no Tutor e os testes. Todos com autor humano? sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A conferência nova em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/assistente/assistente.service.ts:115` só pode fazer a execução falhar antes de chamar o modelo. Nesse caso não sai nada da IA, nada vai para o aluno e nada é consumido, então não há ponto de aprovação a criar. Os fluxos que já nascem pendentes (artefato e entrega) não mudaram.

Supervisão do tutor: ok. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/tutor/tutor.service.ts:181` entrou só um comentário, sem mudança de comportamento. O caso novo do Tutor em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/leitura-por-serie.int.test.ts` testa o reenvio com a execução ainda pendente depois que a licença venceu. Ele confere que a execução fica `falhou`/`NAO_ENCONTRADO`, que só a mensagem do aluno fica na conversa (`[{ autor: 'aluno' }]`), sem resposta da IA, que o adaptador não é chamado e que não há consumo. O registro do que o aluno enviou continua visível ao professor, e nada que a IA gerou fica sem registro.

Autonomia declarada e visível: sim, e não mudou.

As duas recomendações minhas da rodada 1 foram aplicadas:
- **Tutor com a execução pendente no reenvio:** o caso `o Tutor com a execução ainda pendente no reenvio devolve o mesmo id, e a execução falha pelo material…` existe e confere estado, modelo, consumo e mensagens.
- **Outro aluno da mesma turma:** o caso `a chave aceita para um aluno não abre a recusa para outro da mesma turma…` existe. O colega recebe a mesma recusa com a chave aceita e com uma chave nova, nos dois corpos (material aberto `404` e só a atividade `422`), e os gastos não mudam.

A árvore de trabalho em `apps/` é igual à árvore `07d48763`: o que auditei é o que está no checkout.

Bloqueantes: nenhum.

Recomendações:
- O Tutor falha a execução com `NAO_ENCONTRADO` e o chat com `SEM_MATERIAL_DA_SERIE`. Vale conferir se a tela do aluno e a do professor mostram uma mensagem compreensível ao ver a execução `falhou` depois de um `202`, e não um erro genérico. A rodada não traz fotos da tela, por isso fica para a validação.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-14 01:49:44 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Nesta rodada, a nova conferência no `entrada` do chat não diverge da Tech Spec. Ela corrige o código para o que a Tech Spec já pedia. A `techspec.md`, na linha 120, diz que "a conferência depois do `202` repete o mesmo filtro: a execução falha com o código da recusa, sem trecho, sem consumo e sem resposta". O Tutor já fazia isso, e o chat buscava trechos sem recusar quando vinham vazios. A mudança também afeta o `202` comum, quando o material sai antes de a execução rodar. O documento da correção registra isso, e a ordem de correção 1 do `test-engineer` pedia esse caminho, então não é invasão de escopo. O erro chega à tela do professor pelo campo `erro` da execução que falhou (`apps/web/src/areas/professor/assistente/conversa.ts:39`), que já existia. A linha nova de comentário no `tutor.service.ts:181` é só comentário.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`: os dois blocos de mutação do chat foram escritos dentro de "## Revisões", logo depois da tabela. Essa seção é do hook e diz "Não edite à mão". O efeito já aparece: o hook acrescenta cada linha nova no fim do arquivo (`tools/processo/documento-de-revisao.ts:163`), e as rodadas 2 do `infra-guardian` e do `privacy-guardian` ficaram depois do bloco de código, fora da tabela. O `lerRevisoes` ainda as lê, porque procura `| AAAA-` em qualquer ponto depois do título, e o `mutacoes.ts` acha blocos em qualquer parte do arquivo. Por isso a contagem não quebra, mas a tabela fica partida para quem lê. Corrija passando os dois blocos para "## Mutações", depois do bloco do Tutor. A frase "dois para a conferência nova no `entrada` do chat" já está lá e descreve esses blocos.
- `apps/api/test/leitura-por-serie.int.test.ts`: o caso de `atividade_objetiva` e o de `plano_de_aula` provam um comportamento que já existia, a falha com `MATERIAL_INSUFICIENTE` no `#preparar`. O documento declara isso ("Só faltava o teste"). Mesmo assim, nenhuma mutação os amarra a uma linha de produção, então um deles nunca foi visto vermelho. Se quiser fechar isso, inclua uma mutação no `#preparar` do `ferramentas.service.ts` que tire a recusa com trechos vazios.

## test-engineer · 2ª rodada · APROVADO · 2026-11-14 01:51:41 · `tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Correção 1 da rodada anterior:** a execução fica gravada e não roda, o material sai, e o reenvio com a mesma chave volta. Isso vale para a ferramenta (atividade e plano) e para o chat. O teste confere `202` com o mesmo id, a execução `falhou` com o código, o `FakeAdapter.chamar` sem chamada e nenhum `consumo_ia` para aquela execução. O caso do chat tem de ficar vermelho sem a conferência nova, e o ramo novo leva bloco de mutação.
- **Recomendações que a ordem pediu:** conferir o `status` na chave nova do Tutor; outro aluno da mesma turma reenviando a chave no Tutor; o Tutor com a execução pendente; a escola B; o comentário em `tutor.service.ts`.

Cobertos:
- **Correção 1.** Os três casos estão em `apps/api/test/leitura-por-serie.int.test.ts:465`: `atividade_objetiva`, `plano_de_aula` e `chat`.
  - A execução fica parada pelo gatilho na passagem para `rodando`. O material sai, o reenvio devolve `202` com o mesmo id, e a execução termina `falhou` com `MATERIAL_INSUFICIENTE`, `MATERIAL_INSUFICIENTE` e `SEM_MATERIAL_DA_SERIE`.
  - O adaptador não é chamado, não há consumo, e só existe uma `execucao_agente` com aquela chave.
  - O caso do chat prova a conferência nova em `assistente.service.ts:115`. Há dois blocos de mutação: o `if` inteiro e a negação. O caso também depende do `!reenvio &&` que já existia: sem ele, o reenvio receberia `422`.
- **Status na chave nova.** O `toEqual({ status, codigo })` aparece nos casos antigos e nos novos (linhas 501 e 525).
- **Tutor com a execução pendente** (linha 483). A execução falha com `NAO_ENCONTRADO`, sem consumo e sem chamar o modelo, e na conversa só existe a mensagem do aluno.
- **Outro aluno da mesma turma** (linha 501). Com a chave aceita para o primeiro aluno, ele recebe a mesma recusa da chave nova, nos dois corpos.
- **Escola B** (linha 525). A professora da escola B, com a chave aceita na escola A, recebe `422 SEM_MATERIAL_DA_SERIE`, igual à chave nova. Esse caso fica vermelho se o `daChave` deixar de filtrar pela escola.
- **Comentário** em `tutor.service.ts:181`: está lá.
- **O que rodei:** `npx vitest run --project integracao apps/api/test/leitura-por-serie.int.test.ts` deu 37 de 37 verdes. `mutacoes.ts --faltando` diz que nenhuma linha nova com condição ficou sem bloco. Os arquivos de `apps` na árvore são os mesmos da `07d48763`.
- **A conferência nova no chat é coerente com o resto do código.** O `enviar` já exige material da série em todo pedido novo, incluindo o "só conversar". Então a conferência no `entrada` não fecha nenhum caminho que antes era aceito.

Bloqueantes: nenhum

Recomendações:
1. **Os dois blocos de mutação novos estão no lugar errado.** Eles ficaram depois da tabela de `## Revisões` (`tasks/correcoes/2026-11-13-reenvio-fora-do-alcance.md:149-160`), e não em `## Mutações`. O portão lê o documento inteiro, então eles valem. Mas o hook acrescenta as linhas da tabela no fim do arquivo, e a tabela vai ficar partida em volta dos blocos. O texto da seção Mutações (linha 82) também diz que eles estão nela. Mover os dois para dentro da seção resolve.
2. **O comentário do auxiliar descreve uma retomada que o teste não faz.** O comentário de `reenviandoComAExecucaoPendente` (`leitura-por-serie.int.test.ts:350-357`) e o texto do documento (linhas 48 e 67) dizem que é o reenvio que retoma a execução. No cenário do teste, a execução já está em curso no executor, e `packages/core/src/ia/executor.ts:116` (`if (this.emCurso.has(chave)) return`) faz o reenvio não agendar nada. Quem roda o `entrada` depois que o gatilho solta é a execução original.
   - O que o teste prova é que a execução em curso, cujo material saiu antes do `entrada`, falha sem chamar o modelo, e que o reenvio devolve o mesmo id. A retomada de uma execução de fato `pendente` sem executor (o processo caiu) não é exercitada.
   - Isso não bloqueia porque o `entrada` dos três serviços lê tudo pelo que foi gravado com a chave (`#preparar(chaveEnvio)`, `perguntaDaChave`, a pergunta gravada do chat). O código que roda é o mesmo, seja qual for a requisição que agendou.
   - O conserto é corrigir o comentário e o texto, ou criar um caso com a linha `pendente` sem executor em curso, para que o reenvio seja mesmo quem a agenda.
3. **Falta um caso explícito do chat sem reenvio.** O documento (linha 72) diz que a conferência nova vale também para o `202` comum quando o material sai antes de a execução rodar. Hoje isso só está coberto de forma indireta pelo mesmo código. Um caso com o nome desse cenário deixa a afirmação provada.
4. **Concorrência, cobertura extra.** Não há caso com dois reenvios da mesma chave em paralelo (por exemplo, `Promise.all`) depois que o material saiu, conferindo uma execução só e nenhuma chamada ao modelo. A idempotência já existia antes desta correção, então não é exigência dela.
