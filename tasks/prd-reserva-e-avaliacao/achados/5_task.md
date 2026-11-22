# Achados das revisões — `tasks/prd-reserva-e-avaliacao/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 18:55:07 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não escreve em `Nota`. A única linha nova de produção é `peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? false` em `apps/api/src/ia/consumo.repository.ts:36`, e ela grava em `consumo_ia`. Todos com autor humano? Não se aplica, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. A tarefa mexe no roteamento entre provedores e no registro de consumo. Nada decide aprovação, reprovação ou encaminhamento.

Aprovação registrada: ok. Nenhuma saída nova de IA chega ao aluno. O Tutor continua sendo a única exceção da D47, e a reserva atende a mesma tarefa do Tutor pelo mesmo processador, com a mesma política. A exceção não passou para outro agente. O lote (`classificar_secoes`) não gera entrega ao aluno.

Supervisão do tutor: ok. O turno atendido pela reserva passa pelo mesmo processador e pelo mesmo worker, e termina com a execução `concluida`. A tarefa não abre nenhum caminho por fora do registro que o professor vê. O caso em `apps/api/src/ia/fila-de-ia.int.test.ts:352-380` prova que, com a reserva recusada pela D62, o Tutor termina em `IA_INDISPONIVEL` sem chamá-la (contadores `[1, 0]`). Corrigido o cadastro, sem reiniciar, ele passa a ir a ela (`[2, 1]`). Ou seja, a conversa do aluno só vai à reserva aprovada e conferida.

Autonomia declarada e visível: sim, sem mudança. A tarefa não toca o nível nem a tela de governança.

Os demais pontos que verifico:
- **Auditoria (o que a IA gerou, quem aprovou, quando):** não muda. Cada chamada leva o `provedor` dela, e o arquivo do titular lista os dois suboperadores quando a chamada passou pelos dois. Isso reforça o rastro.
- **Vigilância:** nenhuma inferência emocional e nenhuma medida de comportamento. `pelo_provedor_de_reserva` é um contador operacional por chamada e fica fora do arquivo do titular.
- **D46 e D55 (discursiva e redação):** nenhum campo, tela ou prompt de nota.
- **D45 e D64 (medir o professor):** `consumo_ia` continua sem coluna de usuário. A coluna nova não é por professor e não sustenta ranking nem decisão sobre ele.

Bloqueantes: nenhum.

Recomendações:
- A bancada aprova a reserva com `aprovadoPor: 'bancada-de-teste'`, em `apps/api/test/fila-de-ia.fixture.ts:588`. Hoje isso fica só no teste. Se um dia essa função for exportada para fora de `test/`, convém uma guarda que impeça uma aprovação de modelo inventada de chegar à produção.
- Fica como recomendação, não como lacuna desta tarefa. Os casos provam que o Tutor terminou e qual linha de consumo ficou, mas nenhum diz que o turno atendido pela reserva aparece igual para o professor da turma, no modo sala e no resumo do modo casa. Uma asserção na `mensagem_tutor` do caso em `fila-de-ia.int.test.ts:291` fecharia isso para quem audita.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-22 18:55:12 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `consumo_ia`. A tarefa não cria tabela nem migration. A coluna `pelo_provedor_de_reserva` já existia desde a camada-ia 2.0. A tabela tem `escola_id`, e as FKs compostas `(escola_id, execucao_id)` e `(escola_id, aluno_id)` estão em `packages/core/src/db/schema/consumo-ia.ts:79-81`. Os ids continuam UUID. A tabela não varia por período, então não precisa de `anoLetivoId`.

Queries verificadas:
- `ConsumoRepository.registrar` (`apps/api/src/ia/consumo.repository.ts:19-44`): a escola vem de `requireEscolaId()`, nunca do registro. O campo novo vem do destino que o gateway calcula e não decide escopo.
- `registrarEstimada`: não mudou. A escola vem do `returning` do `ExecucaoRepository`.
- `alunoTrailStatement` e `usoRealDoProfessor` (`packages/core/src/titular/compartilhamento.repository.ts:19-30` e `:122-132`): não mudaram e aplicam `requireEscolaId()`.
- `LEITURAS_DO_ARQUIVO.consumo_ia`: mudou só o texto do `fora`, e a coluna continua fora do arquivo.
- A tarefa não traz endpoint novo, `escolaId` vindo do cliente, `@Unscoped()` novo nem leitura da camada rede.
- O `SuboperadorDaEscolaRepository`, montado na bancada, é peça que já existia. A tabela `suboperador` é global e é nossa.

Teste de isolamento: presente, mas não prova a cláusula de escola. A tarefa não acrescenta cláusula de escopo, e o escopo da única escrita nova vem do contexto. Por isso não é bloqueante.

Bloqueantes: nenhum.

Recomendações:
- Dois casos chamados "isolamento" passariam mesmo sem o filtro `c.escola_id = ${escolaId}` em `alunoTrailStatement`. Quem separa as escolas neles é o `aluno_id`, que é diferente em cada uma, e não o escopo. Os casos são:
  - `apps/api/src/ia/fila-de-ia.int.test.ts:316-335`
  - `apps/api/test/arquivo-do-titular.int.test.ts:452-470`

  Uma saída é deixar claro no nome que o caso prova a separação por aluno. A outra é registrar na retro que o isolamento por escola dessa leitura é garantido pela FK composta `(escola_id, aluno_id)` e por `solicitada_por`, e não por um teste de mutação da cláusula.
- A última asserção em `apps/api/src/ia/fila-de-ia.int.test.ts:334` conta zero linhas da escola B com a execução da A. A FK `consumo_ia_execucao_da_escola_fk` já garante isso, então a asserção não prova nada do repository e pode sair ou ser trocada por algo que dependa do código.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 18:55:19 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

O código de produção muda em uma linha só: `peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? false`, em `apps/api/src/ia/consumo.repository.ts:36`. Às 10h, isso não muda o custo de nada.

- **Escrita no banco:** a tarefa acrescenta um campo a uma inserção que já existia. A coluna `pelo_provedor_de_reserva` veio da camada-ia 2.0, é `NOT NULL DEFAULT false` e não vem com migration nesta tarefa. A tarefa não traz leitura nova em produção, então não precisa de índice. Quando a Operação contar as chamadas da reserva (tarefa 8.0), a pergunta do índice volta.
- **Limites, fila e degradação:** nenhum balde, prazo, prioridade nem limite de concorrência foi alterado. O caso do lote prova que, com principal e reserva fora, o job é adiado com `JobAdiadoError('provedor')` e a reserva é chamada uma vez, sem voltar ao principal. O caso da reserva recusada na conferência termina em `IA_INDISPONIVEL` sem chamá-la. Corrigido o cadastro, a mesma instância confere de novo, sem reiniciar.
- **Estado em memória:** nada novo. O `adaptadores` e o `roteirizar` ficam só no fixture de teste.
- **Concorrência:** a tarefa não traz operação que possa rodar duas vezes ao mesmo tempo.
- **Provedor pago:** nenhum teste chama. A bancada usa dois `ScriptedAdapter` e semeia os suboperadores com dados sintéticos.

Recomendações:
- A bancada monta o `LLMGateway` sem o `ResilientAdapter` que o `createLLMGateway` (`packages/core/src/ia/llm-gateway.ts:843-846`) põe no principal e na reserva. Por isso o prazo e o disjuntor separados de cada provedor não passam por esses casos: o "disjuntor" é só o motivo do `LLMError` roteirizado. A tarefa diz isso (autoconferência, item 4), e o `resilient-adapter.test.ts` cobre a parte que falta. Vale um comentário no `#montarORoteirizado` do `apps/api/test/fila-de-ia.fixture.ts` dizendo que a bancada não prova timeout, para ninguém usá-la achando que prova.
- O caso "o ConsumoRepository grava pelo_provedor_de_reserva" (`apps/api/src/ia/fila-de-ia.int.test.ts:430`) depende de `order by em, id` para separar as três linhas, que têm o mesmo `provedor`. Dar a cada linha um `provedorId` próprio e conferir por ele tira a dependência da ordem do `uuidv7()`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 18:55:41 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo. A tarefa só passa a gravar `consumo_ia.pelo_provedor_de_reserva`, que é um booleano da Operação e não identifica ninguém. Também passa a gravar `consumo_ia.provedor` com o id da reserva, e as duas colunas já existiam.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha 99 de `docs/lgpd.md` agora diz:
- o `provedor` pode ser a `IA_RESERVA_PROVEDOR_ID`;
- cada chamada enviada vira uma linha;
- a linha da saída inválida não guarda `entrada` nem `saida`;
- `pelo_provedor_de_reserva` é contador da Operação e fica fora do arquivo do titular.

A finalidade e a retenção da linha continuam preenchidas.

**Autorização por objeto:** ok. Não há rota nova. A escrita do `ConsumoRepository` continua presa à escola do contexto (`requireEscolaId()`), sem `@Unscoped`.

**Logs:** limpos. A mudança de produção é uma linha só (`apps/api/src/ia/consumo.repository.ts:36`) e não escreve log. Nos testes, o logger da `SoberaniaNaSubida` não grava nada.

**Auditoria:** a tarefa não traz nenhuma ação que a regra 20, item 10, obrigue a auditar. Nada mudou em leitura por coordenação, exportação, nota, permissão ou aprovação de saída de IA.

**Envio externo:** é o mesmo de antes, ao principal ou à reserva aprovada e conferida. Cada chamada agora deixa no banco o `provedor` de quem recebeu o conteúdo, e a lista de compartilhamento do aluno mostra os dois suboperadores quando a chamada passou pelos dois. O que prova isso:
- `fila-de-ia.int.test.ts`: o caso misto, o caso só pela reserva e o da reserva recusada na conferência, que termina `IA_INDISPONIVEL` com `[1, 0]` nas chamadas.
- `arquivo-do-titular.int.test.ts`: o `provedor` entra no arquivo e `pelo_provedor_de_reserva` fica fora dele.

Nos testes, nenhuma chamada sai da máquina: os dois adaptadores são `ScriptedAdapter`.

**Seed/fixture:** sintético. Os nomes são "Aluno", "AlunoDaA" e "Empresa principal-xxxx", o contrato é "DPA-5-0" e as chaves são aleatórias.

**Pergunta de fechamento:** o código responde para as chamadas que terminam, com ou sem passagem pela reserva: cada linha leva o `provedor` dela e o `Compartilhamento` lista os suboperadores. A exceção é a execução interrompida, que entra na recomendação 1 e é escopo declarado da 8.0.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Hoje, se o worker morre durante a chamada à reserva, a linha estimada leva só o `provedor` do principal. A lista de compartilhamento então deixa a reserva de fora. Isso contradiz o "nunca os subestima" da linha 99 de `docs/lgpd.md`, que esta tarefa reescreveu. A correção é da 8.0, mas `tasks/prd-reserva-e-avaliacao/8_task.md` não lista `docs/lgpd.md` entre os arquivos previstos. Ponha a linha 99 nela, que passa a dizer "uma estimada por destino", e não deixe a spec pousar sem a 8.0.
2. Dois comentários dizem coisas diferentes sobre a estimada da interrompida:
   - `packages/core/src/ia/consumo.ts:50` (linha que já existia) diz que ela "leva o provedor da reserva", o que só vale depois da 8.0;
   - o comentário novo em `apps/api/src/ia/consumo.repository.ts:10-11` diz que leva o provedor do adaptador configurado, o que vale hoje.

   Acerte os dois na 8.0.
3. Os testes de isolamento entre escolas usam um aluno diferente em cada escola, então seguem passando mesmo sem a cláusula de escola, porque o filtro por titular já separa os dados. Isso aparece em `fila-de-ia.int.test.ts`, no caso "isolamento: a reserva que a escola B usou", e em `arquivo-do-titular.int.test.ts`, no caso "isolamento: a linha da reserva da escola B". Não bloqueia, porque a tarefa não acrescenta cláusula de escopo e a leitura é a de antes. A última asserção do caso de `fila-de-ia` também passa sempre: ela confere que a execução da A não tem linha na escola B. O `tenancy-guardian` decide se pede uma variante com a mesma conta nas duas escolas.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-22 18:56:10 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. Houve uma divergência, sobre onde ficam os testes, e ela está registrada nos três lugares: na `techspec.md` §5 ("A bancada"), no `cenarios.md` §1 (RF1 e RF5) e no `5_task.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**O que conferi**
- **Linha de produção.** A única mudança é em `apps/api/src/ia/consumo.repository.ts:36`: `peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? false`. As duas mutações declaradas pegam essa linha. O teste do repository cobre os três valores (verdadeiro, falso e ausente), e o caso do prazo cobre a linha removida.
- **Bancada.** O `LLMGateway` real é montado só em `apps/api/test/fila-de-ia.fixture.ts:278`, que continua o único lugar que monta o gateway. O guarda de arquitetura (`apps/api/test/architecture.test.ts:1569`) só varre `apps/*/src`, então passar as portas por variável (`this.#portas`) na fixture não o afeta.
- **Ambiguidade da Tech Spec.** A frase "o campo obrigatório é da 5.0", em `techspec.md:90`, combinada com a `4_task.md:100` ("pode torná-lo obrigatório"), deixa a escolha com a 5.0. Ela manteve o campo opcional, o que não é divergência.
- **Linha 99 de `docs/lgpd.md`.** Cobre o que a §7 pede: nomeia `pelo_provedor_de_reserva`, diz "a `IA_PROVEDOR_ID` ou a `IA_RESERVA_PROVEDOR_ID`" e explica por que a coluna fica fora do arquivo do titular.
- **Documentos.** O glossário ganhou a entrada "Saída de reserva" e `docs/mvp-contratos.md` foi atualizado. As duas linhas do `TODO.md` estão marcadas.
- **Fora de escopo, sem invasão.** A interrompida e a contagem da Operação, que são da 8.0, não foram mexidas.

**Recomendações**
1. **`apps/api/src/ia/fila-de-ia.int.test.ts:1026`**: a asserção conta as linhas com `escola_id` da escola B e `execucao_id` de uma execução da escola A. Ela é verdadeira de qualquer jeito e não prova isolamento. O que prova é a foto do compartilhamento de cada escola, feita antes no mesmo caso. Sugiro tirar a asserção ou trocá-la pela foto do aluno da B depois da pergunta da A.
2. **`TODO.md:4288` e `TODO.md:4396`**: falta um ponto antes de "Fechado pela reserva-e-avaliacao…". A linha 4288 termina em "…corte de 21/11/2026)" e a 4396 em "Dono: Arquiteto", e as duas emendam direto no "Fechado".
3. **`5_task.md`**: escrever na tabela de divergências que a 5.0 manteve `ConsumoDeIa.peloProvedorDeReserva` opcional. A `techspec.md:90` deixava essa escolha para a 5.0, e o caso "ausente" do teste do repository depende dela.
4. **`apps/api/test/fila-de-ia.fixture.ts:195`**: `adaptadores` é um campo público e mutável, e só `#montarORoteirizado` deveria escrever nele. Um getter sobre um campo privado deixa isso claro.
5. **"Arquivos previstos" do `5_task.md`**: lista `reserva-na-subida.int.test.ts` como alterado, mas ele não foi tocado. A divergência explica o motivo; dá para ajustar a tabela para não sugerir uma alteração que não aconteceu.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-22 18:57:46 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** o principal estoura o prazo e a reserva atende. Ficam duas linhas no banco, cada uma com o seu `provedor`, e `pelo_provedor_de_reserva` vem `false` e `true`.
- **Compartilhamento:** com o mesmo caso, o compartilhamento do aluno lista os dois suboperadores. Quando a chamada sai só pela reserva, lista só o dela.
- **Arquivo do titular:** o contador da Operação não sai no arquivo, e o `provedor` das duas linhas sai.
- **Recusa na conferência:** com a reserva recusada e o principal fora, o resultado é `IA_INDISPONIVEL` e a reserva não recebe chamada. Com o cadastro corrigido e sem reiniciar, a chamada seguinte vai à reserva.
- **Lote:** com principal e reserva fora, o resultado é `JobAdiadoError('provedor')` e a reserva recebe uma chamada só.
- **Repository:** o `ConsumoRepository` grava os três valores (`true`, `false` e o campo ausente).
- **Isolamento:** duas escolas com a mesma reserva, nos dois arquivos de teste.
- **Concorrência:** a tarefa não traz operação simultânea nova, então não se aplica.

**Cobertos:** todas as linhas da tabela "Testes que provam a regra" têm o seu teste, citado pelo nome:
- Em `apps/api/src/ia/fila-de-ia.int.test.ts` › "a reserva pela bancada do gateway real", os sete casos.
- Em `apps/api/test/arquivo-do-titular.int.test.ts`, "a chamada que saiu para a reserva entra no arquivo do aluno…" e "isolamento: a linha da reserva da escola B…". Rodei os dois e passaram.

As mutações batem com o `git diff`. A única cláusula nova de produção é `consumo.repository.ts:36`, e ela tem os dois blocos (tirar a linha e trocar por `?? true`). Cada bloco aponta para o caso que chega à cláusula. O resto do diff é comentário, documento e a bancada de teste. Não há `.skip`, mock que esconda a regra nem provedor pago (só `ScriptedAdapter`).

A recusa e a reconferência mudam uma coisa só entre as duas metades: a `conferida` da mesma `SoberaniaNaSubida`. Os contadores `[1, 0]` e depois `[2, 1]` distinguem o resultado de verdade.

Não rodei `fila-de-ia.int.test.ts`. O arquivo tem um `describe` que para os processos da fila no compose, e outros revisores usam a mesma árvore ao mesmo tempo. As mutações dele já foram provadas pelo portão da tarefa.

**Bloqueantes:**
1. **`apps/api/src/ia/fila-de-ia.int.test.ts:1098`, `:1107` e `:1108`.** O caso "o ConsumoRepository grava pelo_provedor_de_reserva…" cria três linhas seguidas, cada uma com `em: new Date()`. Elas quase sempre caem no mesmo milissegundo. A asserção `toEqual([true, false, false])` depende de `order by em, id`, e aí quem desempata é o id. A regra 40 diz que o id v7 "não é a ordem de negócio nem desempata duas linhas do mesmo milissegundo". **Correção exigida:** dê a cada linha um `em` distinto (por exemplo `new Date(base + i)`) ou um `provedorId` distinto. Depois verifique cada valor pela linha que ele identifica, sem depender da ordem.
2. **`apps/api/src/ia/fila-de-ia.int.test.ts:947` e `:976`.** O caso "o prazo no principal e a reserva que atende" verifica `[principal, reserva]` na ordem de `linhasDe` (`order by em, id`). O `em` de cada linha é o `relogio.agora()` da chamada (`llm-gateway.ts:715`). Com o `ScriptedAdapter` respondendo na hora, as duas chamadas caem no mesmo milissegundo, e o desempate volta a ser o id, pelo mesmo motivo do item 1. Este caso também é o teste citado no primeiro bloco de mutação. **Correção exigida:** encontre cada linha pelo `provedor` (por exemplo com `find` por `provedor`, ou ordenando pela chave) e verifique `pelo`, `estado` e `codigo_de_erro` de cada uma, sem depender da ordem.

**Recomendações:**
- **Isolamento que não pega a remoção do escopo de escola.** Os casos de isolamento (`fila-de-ia.int.test.ts:1008` e `arquivo-do-titular.int.test.ts`, "isolamento: a linha da reserva da escola B…") usam um aluno diferente em cada escola. Tirar só o escopo de escola do rastro não os derrubaria, porque o filtro por aluno ainda separa as linhas. Eles provam o que a tabela diz ("a mesma reserva" nas duas escolas), e a tarefa não acrescenta cláusula de escopo, então isto não bloqueia. Para pegar essa remoção, o caso precisa do mesmo usuário como aluno em duas escolas, se o modelo permitir.
- **Asserção que sempre passa.** Em `fila-de-ia.int.test.ts:1026`, a contagem de linhas com `escola_id = B` e a execução da A dá zero sempre: a chave estrangeira composta `(escola_id, execucao_id)` já recusa essa linha. Pode sair, ou virar a contagem de linhas da B com `provedor = reserva`, que deve continuar sendo uma.
- **Comentários que se contradizem.** O comentário de `packages/core/src/ia/consumo.ts` (linha que o diff não tocou) diz que a linha estimada da interrompida "leva o provedor da reserva". Já `consumo.repository.ts:11` diz que ela leva o provedor do adaptador configurado. Vale acertar na 8.0, que cuida da interrompida.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 18:58:11 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum perfil novo. A tarefa não adiciona chamada de modelo de produção. Os casos novos usam `ScriptedAdapter` (dublê), com `turno_do_tutor` (perfil `rapido`) e `classificar_secoes` como tarefas de bancada. Nenhum teste chama provedor.

Custo estimado por professor/mês: R$ 0 adicional. A tarefa só grava a coluna `pelo_provedor_de_reserva` e lê o rastro; não cria chamada nem muda perfil. O custo da reserva (cada chamada que cai nela é uma chamada a mais por execução) vem da 4.0 e entra na estimativa da tarefa de preço da F5b, não aqui.

Prompt versionado: não se aplica. Nenhum prompt foi tocado.

Validação de schema: não se aplica. A tarefa não muda saída estruturada. O caminho de saída inválida e o `reservaQuandoInvalida` seguem como estavam.

Aprovação humana no caminho: não se aplica. Nenhuma entrega nova nasce nesta tarefa. A conformidade do Tutor na reserva é a elegibilidade da 4.0: tarefa aprovada, provedor e modelo conferidos, D62 da reserva conferida. A bancada novo a exercita com `aprovadas` e `conferenciaDaReserva`.

Bloqueantes: nenhum.

O que conferi:
- **Porta única e guarda.** O SDK de provedor continua só nos adaptadores. A bancada (`apps/api/test/fila-de-ia.fixture.ts`) monta o `LLMGateway` real com dois `ScriptedAdapter` de `provedorId` próprio. `tools/guardas/executor-so-na-bancada.test.ts` passou.
- **Cláusula nova de produção.** É uma só, em `apps/api/src/ia/consumo.repository.ts`: `peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? false`. Os testes distinguem as duas mutações declaradas:
  - Sem a linha, o caso "o prazo no principal e a reserva que atende" exige `false` e `true` nas duas linhas do banco.
  - Com `?? true`, o caso "o ConsumoRepository grava…" exige `[true, false, false]` (true, false, ausente).
- **Rastro e compartilhamento.** `apps/api/src/ia/fila-de-ia.int.test.ts` lê as linhas gravadas e a foto do `Compartilhamento`. Cobre dois suboperadores, só a reserva (disjuntor aberto, o principal sem linha), recusa na conferência com contadores `[1,0]`, reconferência sem reiniciar com `[2,1]`, e o lote com `JobAdiadoError('provedor')` e `[1,1]` (sem laço). O isolamento tem a mesma reserva em duas escolas, um aluno em cada.
- **Arquivo do titular.** `apps/api/test/arquivo-do-titular.int.test.ts` prova que o `provedor` das duas linhas sai e que `pelo_provedor_de_reserva` não sai (nem nas chaves, nem no texto do objeto). Também prova o isolamento entre escolas A e B.
- **Execução.** `fila-de-ia.int.test.ts` e `arquivo-do-titular.int.test.ts` rodaram: 101 testes passaram. Em `tools/guardas`, 628 de 629 passaram. A única falha foi `ids-retidos-sem-texto.test.ts`, estouro de timeout de 5 s num teste que varre a árvore inteira, com a máquina carregada. É arquivo que a tarefa não toca.
- **Documentos.** Em `docs/lgpd.md`, a linha 99 acrescenta "uma linha por chamada enviada", a saída inválida sem `entrada` nem `saida`, a coluna como contador da Operação e nenhum campo pessoal novo. O glossário, `docs/mvp-contratos.md` e as três linhas do `TODO.md` estão fechados. Os comentários de `consumo.ts`, `consumo-ia.ts` e `leitura-do-titular.ts` dizem "enviadas" e batem com `llm-gateway.ts:765`.
- **Tenancy.** Nenhuma cláusula de escopo nova e nenhum `@Unscoped`. O repository segue com `requireEscolaId()`.
- **Privacidade.** A coluna não entra no arquivo do titular, o `provedor` entra, e a tabela de dados da linha 99 está atualizada na mesma tarefa.

Recomendações:
1. O caso de isolamento em `apps/api/src/ia/fila-de-ia.int.test.ts` (o `it` "isolamento: a reserva que a escola B usou…") é fraco na segunda metade. Depois de a escola A perguntar, ele só confere que há 1 linha da execução da A e 0 da execução da A na B. Não relê o compartilhamento das duas. Um `expect(doRastro(await fotoDoAluno(a), [reserva])).toEqual([reserva])`, com a B ainda sem a linha da A, fecharia o par. O isolamento de verdade já está provado em `arquivo-do-titular.int.test.ts`, por isso não bloqueia.
2. Em `reserva-na-subida.int.test.ts`, listado como "alterado" nos arquivos previstos, não há diff. A divergência já está justificada na tabela da tarefa; basta tirar o arquivo da lista na hora de fechar.
3. `afterAll` e `afterEach` do bloco novo apagam `suboperador` por chave e `consumo_ia` por escola. Está correto para dado global sintético; só manter o padrão se outros blocos semearem suboperador de alcance `todas`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 19:15:05 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum

Esta rodada conferiu o diff desde a 1ª, que só mexe em teste e em documento.

**Os dois casos que o `test-engineer` reprovou**
- `apps/api/src/ia/fila-de-ia.int.test.ts:976-980`: o caso misto não depende mais de `order by em, id`. Ele exige duas linhas e acha cada uma pelo `provedor`. Como `chaveNova` gera chaves diferentes para o principal e a reserva, a busca não se confunde.
- `apps/api/src/ia/fila-de-ia.int.test.ts:1081-1114`: o teste do `ConsumoRepository` também não depende mais da ordem. Ele lê as linhas de uma escola nova, exige três e confere cada valor pelo `provedor`. Os três casos (`true`, `false` e o campo ausente, que vale `false`) continuam provados.
- Nos casos que esperam uma linha só, o `toMatchObject` sobre a lista continua exigindo exatamente uma, então o `order by provedor` não esconde nenhuma linha a mais.

**As recomendações da 1ª rodada**
- A conferência de isolamento sempre verdadeira (`count` da escola B com a execução da A) saiu. No lugar, o caso confere que a foto da A ganha a reserva e a da B continua com a dela (`fila-de-ia.int.test.ts:1022-1026`). O nome do caso agora diz que a separação é por aluno, e o mesmo vale em `apps/api/test/arquivo-do-titular.int.test.ts:579`. O caso que pegaria a remoção do escopo de escola em `alunoTrailStatement` foi para o `TODO.md`, com dono.
- A decisão de manter o campo opcional está registrada no `5_task.md` e na `techspec.md` §5. O `cenarios.md` não precisava mudar: nenhum cenário muda, e a linha 64 (a interrompida com `false`) continua de acordo com a escolha.
- `adaptadores` agora é só de leitura na bancada, e o comentário de `#montarORoteirizado` diz que ela roda sem o `ResilientAdapter`.
- "Arquivos previstos" explica por que `reserva-na-subida.int.test.ts` não foi tocado.
- As três pendências novas foram para o `TODO.md`, cada uma com dono. Faltavam os pontos finais nas duas linhas fechadas; agora estão lá.

Recomendações:
- `apps/api/src/ia/fila-de-ia.int.test.ts:1097-1109`: depois que a leitura passou a achar a linha pelo `provedor`, `base + indice` em `em` não serve mais para nada. O comentário da linha 1096 ("Cada linha tem o `provedor` e o instante dela") sugere que o instante importa. Pode voltar a `new Date()`.
- A contradição entre os comentários de `packages/core/src/ia/consumo.ts` e de `apps/api/src/ia/consumo.repository.ts` sobre a estimada da interrompida continua no código até a 8.0. O `TODO.md` já registra isso; a validação da spec precisa conferir que a 8.0 corrigiu.

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 19:15:14 · `tasks/prd-reserva-e-avaliacao/5_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** Estes são os mesmos da 1ª rodada, porque a tabela de testes da tarefa não mudou.
- A chamada vai à reserva quando o principal estoura o prazo. Ficam duas linhas, com `pelo_provedor_de_reserva` falso numa e verdadeiro na outra, e cada uma com o `provedor` dela.
- O compartilhamento do aluno lista os dois suboperadores.
- A chamada que só passou pela reserva lista só o suboperador dela.
- O isolamento entre escolas que usam a mesma reserva.
- A reserva recusada na conferência, e depois o cadastro corrigido sem reiniciar.
- O lote com principal e reserva fora, que adia o job com `JobAdiadoError(provedor)`.
- O `ConsumoRepository` grava a coluna como `true`, como `false` e, quando o campo falta, como `false`.
- O contador da Operação fica fora do arquivo do titular.

**Cobertos:** Os dois itens exigidos na 1ª rodada foram corrigidos.
1. Em `apps/api/src/ia/fila-de-ia.int.test.ts:1081-1115`, cada linha agora tem `provedorId` próprio (`provedor-do-repository-${indice}`) e um `em` diferente (`base + indice`). A leitura não tem `order by`, e cada valor é conferido por um `Map` indexado pelo `provedor`. O resultado não depende mais da ordem do id v7.
2. Em `apps/api/src/ia/fila-de-ia.int.test.ts:976-980`, o teste confere `toHaveLength(2)` e acha cada linha com `find` pelo `provedor`. Para cada uma, confere `pelo`, `estado`, `codigo_de_erro`, `envio_externo` e `aluno_id`. Os demais usos de `linhasDe` (linhas 1005, 1019, 1024 e 1056) esperam uma linha só, então trocar o `order by em, id` por `order by provedor` não muda nada neles.

As duas mutações declaradas continuam chegando à cláusula:
- **Remover a linha** `peloProvedorDeReserva`: a coluna fica com o padrão `false`, e o `find` da linha da reserva quebra em `pelo: true`.
- **Trocar `?? false` por `?? true`**: a linha `provedor-do-repository-2` passa a valer `true` e quebra o `toBe(false)`.

Rodei `npx vitest run apps/api/src/ia/fila-de-ia.int.test.ts -t "a reserva pela bancada do gateway real"`: 7 passaram, 29 foram filtrados pelo `-t` e nenhum está com `.skip`.

O caso de isolamento reescrito (linhas 1009-1027) prova o seguinte. Antes de a escola A perguntar, a foto do aluno da A não tem a reserva que a B usou. Depois de cada pergunta, cada aluno tem a reserva na sua própria foto. O nome do caso agora diz "a separação é por aluno". Falta um caso que pegue a retirada do escopo de escola em `alunoTrailStatement`, mas isso tem destino no `TODO.md` e a tarefa não acrescenta cláusula de escopo.

O resto do diff não muda o que os testes provam:
- `fila-de-ia.fixture.ts`: `adaptadores` virou campo privado com getter de leitura, e o comentário agora diz que a bancada roda sem o `ResilientAdapter`.
- A tarefa registra como divergência que `peloProvedorDeReserva` continua opcional, e a techspec foi atualizada.
- O nome do caso em `arquivo-do-titular.int.test.ts` mudou.
- O `TODO.md` ganhou as linhas novas.

**Bloqueantes:** nenhum.

**Recomendações:**
- Em `apps/api/src/ia/fila-de-ia.int.test.ts:943`, o comentário de `linhasDe` ainda diz "na ordem das chamadas", mas a consulta agora ordena por `provedor`. Trocar por algo como "ordenadas pelo `provedor`; o teste acha cada linha pelo provedor, não pela posição".
- As recomendações da 1ª rodada já têm destino no `TODO.md`: a linha estimada por destino na 8.0, os dois comentários que se contradizem sobre a estimada da interrompida, e o isolamento pelo `escola_id` em `alunoTrailStatement`.
