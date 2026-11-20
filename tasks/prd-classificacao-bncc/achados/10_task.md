# Achados das revisões — `tasks/prd-classificacao-bncc/10_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-20 00:09:31 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. Revi o uso de `secao_do_material` e `habilidade_da_secao`, que têm `escola_id` e não variam por período (o caso da virada do ano cobre isso), de `habilidade_bncc` (tabela pública, sem dono), de `suspensao_de_funcao`, `serie` e `disciplina`.

Queries verificadas:
- `SecoesRepository.habilidadesDasPaginas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`, a partir da linha 163): a escola vem de `requireEscolaId()`. A série é presa por `serie.escolaId = escolaId`. A disciplina é presa por `disciplina.escolaId = serie.escolaId`. A seção é presa por `secaoDoMaterial.escolaId = escolaId`, e a junção da habilidade usa `escola_id` e `secao_id`. Nada do escopo vem do cliente.
- `TrechoSearch.findComHabilidades` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/trecho-search.ts`): as páginas vêm do `find`, que já tem escopo. A `serieId` vem da turma conferida em `turmaComDisciplina`, e não do corpo do pedido.
- `SuspensaoRepository.estaSuspensa`: escopo pela escola do contexto.
- `DesempenhoRepository` e `AnalistaRepository`: a mudança é só de tipo (`codigo: string | null`). O escopo e a agregação continuam como estavam. A camada de rede continua vendo só agregado, e a linha `null` não abre dado individual.
- `ferramentas.command.ts`: a métrica `ia.habilidade_anulada` leva só `escola_id` no rótulo, e esse valor vem de `requireEscolaId()`.
- Nenhum endpoint novo recebe `escolaId`. Nenhum `@Unscoped` novo: o que aparece em `secoes.repository.ts:145` já existia e tem justificativa.

Teste de isolamento: presente e efetivo. O caso "a busca de A não alcança a seção de B…" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/geracao-pela-secao.int.test.ts:291`) passa o `materialId` de B no contexto de A. Removi mentalmente `eq(secaoDoMaterial.escolaId, escolaId)`: a junção ainda pegaria a seção de B, porque o `escola_id` da junção sai da própria seção, e `EM13CNT104` voltaria. O teste quebra. Ele tem um contraponto positivo no contexto de B e um bloco de mutação declarado. O caso "série de outra escola" (linha 285) prova o escopo de `serie`.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/geracao-pela-secao.int.test.ts:303` ("a geração de A nunca leva a habilidade de B…") não quebra se o escopo da seção sair, porque o `find` já limita os trechos ao material de A. Quem prova o escopo é o caso da linha 291. Vale dizer isso no nome do caso ou tirá-lo.
- `habilidadesDasPaginas` é pública e não confere o estado nem a licença do material, porque confia que as páginas vêm do `find`. Não há risco entre escolas, mas um chamador futuro poderia ler as habilidades de material excluído da própria escola. Vale escrever essa premissa no comentário do método, ou só aceitar trechos já buscados.

## pedagogia-reviewer · 1ª rodada · APROVADO · 2026-11-20 00:10:21 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO

Amostras avaliadas: 14. Foram os 2 prompts reescritos (atividade e plano), a entrada e a recusa do Tutor, o texto do relatório da correção, o roteiro da demonstração, a AIA do diagnóstico e os 7 pontos de tela com `habilidade: null`: Atividade da aluna, Aprovar (resumo e tabela), TurmaHoje, Analista, DadoNominal, a folha do artefato e a aba Alunos. Rodei `conferencia.test.ts`, `conteudo.test.ts` e `turno-do-tutor.test.ts`, com 556 testes verdes. Não rodei os testes de integração nem o e2e, e o prompt não trouxe fotos da tela.

Problemas por categoria:
- Nível e alinhamento curricular: sem achado. A habilidade da questão passa a ser a da BNCC da seção da página citada, filtrada pela série e pela disciplina atuais da turma. O teste do material com habilidades do 6º e do 9º ano prova que a turma do 9º não recebe `EF06…`.
- Distratores e gabarito: não foram tocados. O gabarito continua sendo o índice da correta, e o Tutor continua recebendo a questão sem gabarito (`questaoSemGabarito`).
- Tutor: a entrada continua estrita, com `materialId`, `pagina` e `texto`, e o teste passa `habilidades` e espera a rejeição. O teste de integração confere que o pedido ao modelo não contém o código da seção nem `habilidades=`. A política socrática e a recusa de escopo não mudaram. A questão sem habilidade não derruba o turno e não vira memória por habilidade, o que está de acordo com a D66.
- Tom do texto gerado: "vale retomar o conteúdo desta questão" é natural em português e não desanima.
- Tela e texto: o rótulo "Sem habilidade" aparece em 7 pontos e nenhuma tela lê `.codigo` de `null`. O desenho final é da 12.0, como a tarefa declara.

Exemplos concretos do que saiu errado (nenhum bloqueante):
1. `apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx:136-146`: o plano de aula sem habilidade, caso agora previsto (`habilidades: z.array(...).max(6)` e o prompt manda devolver lista vazia), mostra o título "Habilidades" com a lista vazia embaixo. A professora vê um cabeçalho sem conteúdo. A questão tem tratamento ("Sem habilidade"), o plano não.
2. `packages/shared/src/assistente/conteudo.ts` (`descricaoParaOModelo`): as 162 habilidades da BNCC acima de 300 caracteres chegam à professora e à aluna cortadas com "…" (artefato, "Acertos por habilidade"). O texto inteiro continua em `habilidade_bncc`. Está justificado pelo teto de entrada de IA, mas a professora pode estranhar uma descrição da BNCC truncada.
3. `apps/web/src/areas/aluno/Atividade.tsx:322`: a aluna vê uma barra "Sem habilidade" em "Acertos por habilidade", sem explicação. A explicação curta é da 12.0.
4. `docs/roteiro-da-demonstracao.md:186-191`: o passo 1 do roteiro ganhou uma ação longa (abrir o painel, corrigir, salvar), mas o cabeçalho continua "2 min". Quem apresenta vai estourar o tempo.

Ajuste sugerido no prompt ou na recuperação de contexto: nenhum no prompt. A instrução "use null se nenhuma se aplicar" e "nunca use o de outro trecho" é clara e está alinhada com a conferência na gravação. O risco de um modelo real preferir `null` por conservadorismo só aparece com o modelo da produção, e o Arquiteto já registrou que a taxa de suspensão é medida lá.

Bloqueantes: nenhum.

Recomendações:
- Na 12.0, esconder o bloco "Habilidades" do plano quando a lista vem vazia, ou escrever uma linha curta, por exemplo "Nenhuma habilidade da BNCC nas seções citadas" (`ConteudoDoArtefato.tsx:136`).
- Na 12.0, acrescentar na tela da aluna uma frase curta junto de "Sem habilidade", por exemplo "questões que não pertencem a uma habilidade da BNCC", para a barra não parecer defeito ou lacuna.
- Reajustar o tempo declarado do passo 1 do roteiro (`docs/roteiro-da-demonstracao.md:166`) ou marcar o passo 3 como opcional.
- Se a professora estranhar a descrição cortada, avaliar mostrar o texto completo da `habilidade_bncc` na tela do artefato, mantendo o corte só na entrada do modelo.
- Retomar a recomendação já registrada pela tarefa sobre as atividades antigas com `QUI.EM.*` na produção, que ficam com um código fora de `habilidade_bncc`.

Arquivos relevantes (absolutos):
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/aluno/Atividade.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/assistente/conteudo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/prompts/gerar-atividade-objetiva.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/prompts/gerar-plano-de-aula.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/roteiro-da-demonstracao.md

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-20 00:10:37 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A tarefa mexe na habilidade da questão (código e descrição da BNCC, que é tabela pública) e no `por_habilidade` do diagnóstico, que já existia e agora aceita `codigo: null`. Esse diagnóstico é dado do aluno que já estava mapeado, e a tarefa não muda o que ele guarda de pessoal: não entra aluno novo, nome, nem texto sobre a pessoa. `habilidade_da_secao` é dado do material da escola, não de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- `readDaFerramenta` (`apps/api/src/artefato/ferramentas.command.ts:35-38`) confere o vínculo da turma e da disciplina antes da busca.
- `habilidadesDasPaginas` (`apps/api/src/material/secoes.repository.ts:238-282`) pega o `escolaId` do contexto (`requireEscolaId`) e o usa na série, na disciplina, na seção e no join da habilidade.
- A mutação que tira o `where` da seção tem caso que fica vermelho (`geracao-pela-secao.int.test.ts` › "a busca de A não alcança a seção de B").
- Nenhum 403 novo: o que não se acha continua `NAO_ENCONTRADO`.

Logs: limpos. O diff não acrescenta nenhuma chamada de logger nem de console. A métrica nova `ia.habilidade_anulada` (`packages/core/src/telemetry/metrics.ts:248`, `apps/api/src/ia/metricas-da-execucao.ts:191-193`) só tem `escola_id` no rótulo e está em `METRICS_WITH_ESCOLA`. O painel do Grafana (`infra/grafana/paineis/fundacao.json`, id 57) agrupa só por `escola_id`.

Auditoria: presente.
- A leitura nominal do Analista continua registrada na mesma transação (`apps/api/src/governanca/analista.service.ts`, logo depois do `porHabilidade` alterado).
- A tarefa não cria leitura, exportação, mudança de nota ou de permissão, nem aprovação de saída de IA que precise de auditoria nova.
- O artefato continua nascendo pendente pelo caminho que já existia.

Envio externo:
- **Geração (atividade e plano):** o que vai a mais para o modelo são os códigos e descrições públicos da BNCC de cada trecho. Nenhum dado de aluno ou de professor entra. Vai pela porta e pela fila de sempre (`comRegistro`), então fica registrado em `ExecucaoAgente`.
- **Tutor:** não recebe as habilidades da seção. Só `findComHabilidades` as traz, e só `ferramentas.command.ts:38` a chama. O Tutor usa o `trechoSchema` estrito, e isso está provado em `apps/api/src/tutor/tutor-modelo.int.test.ts:240`, com mutação.
- **Memória do Tutor:** a linha `codigo: null` não entra (`apps/api/src/tutor/turno.command.ts`), e isso segue a D66.
- **Camada de rede:** não ganha acesso novo à conversa.

Seed/fixture: sintético. Os códigos `QUI.EM.*` viraram `EM13CNT101` a `104`, que existem em `habilidade_bncc`, e o caso "todo código do seed existe" prova isso. Não há nome, matrícula ou conteúdo real nos fixtures alterados nem em `apps/api/test/geracao-pela-secao.int.test.ts`.

Pergunta de fechamento: continua respondida. O diagnóstico por aluno segue nas mesmas tabelas que o arquivo do titular já lê, e o que foi enviado segue em `ExecucaoAgente`. A tarefa não abre caminho novo de dado nem de envio.

Bloqueantes: nenhum.

Recomendações:
- **`DadoNominal.tsx` não tem teste de unidade da linha `habilidade: null`.** Fica para a 12.0, como o próprio plano registra. A API já tem o caso em `analista.int.test.ts`.
- **Na migração das atividades antigas com `QUI.EM.*`,** se a 11.0 ou a retro decidir fazer, a rotina deve mudar só o conteúdo do artefato. Não deve tocar em correções aprovadas sem passar pela auditoria de alteração de nota, já que o `por_habilidade` de lote aprovado é parte do registro da validação.

## llm-integrator · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-20 00:10:38 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: AJUSTES NECESSÁRIOS

Perfis usados: `padrao` em `gerar_atividade_objetiva`, `gerar_plano_de_aula` e `adaptar_atividade`. Nenhum perfil mudou nesta tarefa, e o perfil `padrao` é adequado: geração com citação e conferência. O Tutor, a proposta do chat e a classificação seguem como estavam.

Custo estimado por professor/mês: esta tarefa não acrescenta chamada de modelo nem muda o perfil. Cada geração que a professora já pede passa a mandar, junto de cada trecho, os códigos das habilidades da seção, mais uma lista única com as descrições (`habilidades_da_bncc`). Antes eram até 6 habilidades fixas do catálogo próprio. Estimo de +300 a +1.500 tokens de entrada por geração, no uso comum de 3 a 6 seções distintas, com descrições de cerca de 150 caracteres. O número de gerações por professor por mês é o que a tarefa 1.0 já projetou, e não pude conferir essa projeção aqui. Não calculei o custo em reais porque não abri a tabela de preços. A conta fica quase igual à de antes.

Prompt versionado: sim. Os dois prompts mudaram de `2026-10-04.2` para `2026-11-19.1`, com o hash novo em `prompts-caracterizados.test.ts`. O prompt de `adaptar_atividade` não mudou, porque a regra dele de copiar a habilidade como veio continua valendo.

Validação de schema: sim.
- `trechoDeGeracaoSchema` é estrito, e `habilidade` virou `nullable`.
- A saída do modelo é conferida em `problemasDasQuestoes` e na validação do plano.
- A anulação na gravação (`anularHabilidadesForaDaSecao`) soma `ia.habilidade_anulada` só com `escola_id` no rótulo.
- Nenhum SDK de provedor aparece fora dos adaptadores.
- Os testes usam `fila.comModelo` e o `ScriptedAdapter`, sem chamar provedor pago.
- O Tutor segue no `TrechoSearch.find`, sem habilidade da seção.

Aprovação humana no caminho: não se aplica. A geração continua nascendo `pendente`, e esta tarefa não mexeu nesse caminho.

Bloqueantes:

1. **O teto de entrada das duas tarefas de geração fica abaixo do pior pedido válido.**
   - **Onde:** `packages/core/src/ia/tasks/gerar-atividade-objetiva.ts:240` e `packages/core/src/ia/tasks/gerar-plano-de-aula.ts:99` (`maximoDeTokensDeEntrada: 26100`, sem mudança nesta tarefa). A prova está em `packages/core/src/ia/teto-de-entrada.test.ts` e `teto-de-entrada.ts`.
   - **O que está errado:** o schema agora aceita 12 trechos, cada um com até 5 habilidades de 300 caracteres. A união de habilidades distintas (`habilidades_da_bncc`) pode chegar a 60 entradas, e antes eram no máximo 6.
   - **O que medi:** montei esse pedido com `piorEntradaDaTarefa` e `tokensDoPedido`, e deu cerca de 30.900 tokens para a atividade e para o plano. Isso passa dos 26.100 do teto. O gateway recusaria um pedido válido com `PEDIDO_ACIMA_DO_TETO`, que a própria documentação do teto define como "defeito nosso".
   - **Por que o teste não pegou:** o gerador do pior pedido repete o mesmo valor em todos os trechos. A união deduplica e fica em 5 habilidades, então o teste passa com 26.036 e 26.055 tokens. O teste está verde sem provar a regra.
   - **Correção exigida (uma das duas):**
     - (a) Limitar a união que vai ao prompt, por exemplo `habilidadesDosTrechos(...).slice(0, N)` na entrada, ou um limite no schema. O N tem de caber no teto, e a conferência (`codigos`) tem de usar a mesma união cortada.
     - (b) Subir o teto das duas tarefas para o pior real, com no máximo 10% de sobra, e fazer o gerador de `teto-de-entrada.ts` (ou um caso dedicado em `teto-de-entrada.test.ts`) montar trechos com habilidades distintas, para o teste quebrar se o campo crescer de novo. O teto é o que a regra 80 e o limitador leem, então mexer nele exige revalidar a reserva de tokens.
   - Em uso comum o problema quase não aparece, porque exigiria 12 trechos de seções diferentes com 5 habilidades longas cada, além de trechos grandes. Mas é um bug latente, e a regra que o protege hoje não tem teste.

Recomendações:
- Registrar no relatório a projeção de gerações por professor por mês junto com o delta de tokens, para a precificação não depender de memória.
- Uma habilidade que o modelo inventa e que não veio em nenhum trecho continua indo para a repetição por `IA_SAIDA_INVALIDA`. Isso é correto, mas a tarefa 11.0 pode medir no painel quanto isso custa em reexecuções, além da anulação já contada em `ia.habilidade_anulada`.
- As recomendações da própria tarefa (migrar os `QUI.EM.*` antigos, testar o `DadoNominal.tsx`, medir o `or(...)` de `habilidadesDasPaginas`) ficam como estão, sem bloquear.

Arquivos relevantes (caminhos absolutos):
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/tasks/gerar-atividade-objetiva.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/tasks/gerar-plano-de-aula.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/teto-de-entrada.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/ia/teto-de-entrada.test.ts`

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-20 00:11:13 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: IA, prova
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: bloqueante
Métrica e alerta: ok

Bloqueantes:

1. **Voltar o código depois da 10.0 quebra a abertura da prova.**
   - **Onde:** `packages/shared/src/assistente/conteudo.ts:78` e `:106`, junto com `packages/shared/src/atividade/correcao.ts:37` e `:47` e `packages/shared/src/atividade/prova.ts:160`.
   - **O que está errado:**
     - A tarefa passa a gravar dois formatos novos no `jsonb`: questão com `habilidade: null` e plano com `habilidades: []`. O diagnóstico ganha `codigo: null`.
     - Na mesma entrega, ela muda os leitores para aceitar esses formatos. A versão que está na produção não lê nenhum deles. Por exemplo, `minha-atividade.service.ts:87` no HEAD faz `conteudoDeAtividadeSchema.parse` com `habilidade` obrigatória. O mesmo vale para `atividade-aplicada.service.ts:124`, `correcao.service.ts:95` e `:142`, e `artefato.service.ts:32`, `:94` e `:121`.
     - Toda atividade gerada depois do deploy com seção `aguardando`, `sem_habilidade`, fora de capítulo ou anulada leva `null`. Esse caso vai ser frequente.
     - Se o deploy for revertido, o aluno não abre a prova dessas atividades e recebe 500. A correção do lote dessas atividades também falha. Isso viola a regra 80, item 9 ("rollback é um comando").
     - A própria Tech Spec promete o contrário: `techspec.md:195`, §7c, diz "a versão anterior lê … questão com `null` (teste)". Esse teste não existe, e o runbook não tem a seção "Voltar o código depois da classificacao-bncc 10.0". As voltas da 2.0 e da F4 seguiram esse padrão, com SQL testado.
   - **Correção exigida, uma das duas:**
     - (a) **Expandir antes de gravar.** A leitura que aceita `null` (os `.nullable()` dos schemas de `packages/shared` e os leitores da API e da web) vai a um pouso anterior ao do código que grava `null`. A ordem fica registrada na Tech Spec §7c e no `TODO.md`, com o teste que a §7c promete: o conteúdo com `null` lido pelos leitores da versão de volta.
     - (b) **Volta pelo runbook.** Escrever a seção "Voltar o código depois da classificacao-bncc 10.0 (rollback)" em `docs/runbook.md`. Ela diz o que acontece com as atividades e planos gravados com `null` e `[]` e qual procedimento os deixa legíveis ao código anterior, sem inventar habilidade (D7/D55 não se aplicam, mas o diagnóstico não pode ganhar código falso). O procedimento tem teste que o roda, no padrão de `volta-da-2-0.int.test.ts`. A linha da §7c é corrigida para dizer o que de fato vale.

Recomendações:

1. **O `EXPLAIN` não testa a consulta que roda.** `apps/api/test/geracao-pela-secao.int.test.ts:355` testa uma página só, com SQL escrito à mão. A consulta real de `secoes.repository.ts` (`habilidadesDasPaginas`) é um `or(...)` de até 12 páginas, gerado pelo Drizzle. Vale capturar a instrução gerada, com 12 páginas, e conferir o índice nela. O cenário "Carga" do `cenarios.md` cita o join da busca "da 10.0".
2. **A métrica conta duas vezes quando a transação é refeita.** Em `apps/api/src/artefato/ferramentas.command.ts:55`, `ia.habilidade_anulada` soma dentro da transação do `concluir` e antes do `create`. Se a transação desfaz e o job é refeito (entrega ao menos uma vez, D49), a contagem dobra. Melhor somar depois do commit, ou aceitar e anotar no painel que a contagem pode passar do real.
3. **Faltam consultas no preparo da geração.** `findComHabilidades` (`trecho-search.ts:100`) acrescenta três leituras ao `preparar` da fila `ferramenta`: suspensão, recorte da turma e o join. Não há latência própria delas. Se a duração da execução subir, convém um histograma do passo.
4. **Atividades antigas com `QUI.EM.*` continuam no banco.** A leitura aceita o código, mas o `por_habilidade` dessas atividades fica com código que não existe em `habilidade_bncc`. Conferir a contagem na produção (D82) antes da 11.0.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/assistente/conteudo.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/atividade/correcao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/atividade/prova.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/geracao-pela-secao.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/ferramentas.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/trecho-search.ts`

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-20 00:11:47 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `cenarios.md`, "Geração e Tutor" (a questão que cita duas seções)
Portão local: carimbo válido

**Bloqueantes:**

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md:140-141`: uma divergência está registrada só na tarefa.
   - **O que está errado:** a linha ainda promete que "a questão que cita páginas de duas seções escolhe entre a união delas". O `10_task.md:82` (terceira divergência) diz que esse caso não existe, porque a questão tem uma `citacao` só (`citacaoSchema`) e quem cita várias seções é o plano. A coluna "Onde está na spec" aponta para essa linha do `cenarios.md`, mas a linha não foi alterada (o diff do `cenarios.md` só mexe no caso do chat).
   - **Consequência:** a tabela "Testes que provam a regra" (`10_task.md:48`, "questão que cita dois") fica com um cenário que nenhum teste cobre.
   - **Correção exigida:** reescrever a linha 140-141 do `cenarios.md`. Ela deve dizer que a questão cita uma página só, que a união das seções vale para o plano e que a questão escolhe entre as habilidades da seção da página que cita. Depois, ajustar a linha 48 da tabela de testes para não citar o caso que saiu.

**Recomendações:**

- `apps/api/src/artefato/ferramentas.command.ts:55`: `ia.habilidade_anulada` é somada dentro da transação do `concluir`, antes do commit. Se a gravação falhar, a contagem já foi feita, e a reentrega soma de novo (D49). Vale emitir depois do commit ou aceitar e registrar a sobrecontagem. A carga é do `infra-guardian`.
- `packages/core/src/ia/tasks/gerar-plano-de-aula.ts:29`: `MAXIMO_DE_HABILIDADES_DO_PLANO = 6` repete o literal `.max(6)` de `packages/shared/src/assistente/conteudo.ts:106`. Vale exportar a constante do contrato e usá-la nos dois lugares.
- Uma seção que está sendo reclassificada fica `aguardando` e mantém as habilidades `origem: 'ia'` antigas até a nova execução concluir. Por isso, `habilidadesDasPaginas` (`apps/api/src/material/secoes.repository.ts`) ainda as entrega à geração. O cenário "seção `aguardando` dá `null`" foi escrito para o material novo, e esse comportamento parece aceitável, mas não está escrito na §5 nem na tabela de estados da §7c. Vale uma linha na Tech Spec.
- A tarefa já pôs o rótulo "Sem habilidade" nas telas (`ROTULO_SEM_HABILIDADE` em `Atividade.tsx`, `Analista.tsx`, `DadoNominal.tsx`, `Aprovar.tsx`, `TurmaHoje.tsx`, `ConteudoDoArtefato.tsx` e `alunos-da-turma.ts`). A justificativa está só na seção "Fora do escopo" da própria tarefa. Vale registrar em `tasks.md`, na 12.1, que o rótulo já existe e que a 12.0 acrescenta a explicação e o desenho, para a 12.0 não refazer o trabalho.
- `e2e/professor-turma-alunos.spec.ts`: o caso foi dividido em dois por causa do prazo de 15 s. Isso não estava previsto na tarefa nem está registrado no `10_task.md`. Vale uma linha dizendo por quê.
- `DadoNominal.tsx` segue sem teste de unidade. A tarefa já registrou isso para a 12.0, e a recomendação fica mantida.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 00:13:25 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: a questão leva a habilidade da seção da página que cita, e o plano leva a união das seções que cita.
- Anulação: habilidade de outra seção, ou `QUI.EM.05`, sai como `null` na gravação, e `ia.habilidade_anulada` soma só para a escola certa.
- Bordas da classificação: seção `aguardando` ou `sem_habilidade`, e página antes do primeiro capítulo.
- Função suspensa: só vale a origem `coordenacao`. A correção da coordenação vale na geração seguinte.
- Recorte: material passado do 6º ao 9º, série que não é a da turma, disciplina sem componente.
- Virada do ano.
- Dois materiais com o mesmo número de página.
- Tutor: não recebe as habilidades da seção, e a questão com `null` não derruba o turno.
- `QUI.EM.05` recusado em cada saída.
- `codigo: null` no `por_habilidade` (correção, lote, desempenho, Analista, dado nominal), e cada tela abre com `null`.
- Leitura do legado: atividade com `QUI.EM.05` e atividade com `null`.
- Seed: todo código existe em `habilidade_bncc`.
- Isolamento: a busca de A não alcança a seção de B, nem pela geração, nem pela métrica.
- `EXPLAIN` do join da busca.
- E2E do roteiro com a correção do capítulo 7.

**Cobertos:**
- Todas as linhas da tabela citam um caso que existe.
- `geracao-pela-secao.int.test.ts` passou: 16 de 16, rodado aqui.
- Não há `.skip`, `.only`, teste comentado nem `any` no diff dos testes.
- A IA nos testes usa só o `ScriptedAdapter` e o adaptador falso.
- Os testes asseveram resultado, não só execução. O isolamento é efetivo: o caso tira o escopo e confere que o contexto de B enxerga a seção de B.
- Rodei `mutacoes.ts --faltando`: lista as 7 linhas que o documento declara. Seis têm justificativa de mutante equivalente que se sustenta; as três de `DadoNominal.tsx` não (bloqueante 2).

**Bloqueantes:**

1. **O `EXPLAIN` não roda a consulta da busca.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/geracao-pela-secao.int.test.ts:337-368`.
   - O que está errado: o caso faz o `EXPLAIN` de um SQL escrito à mão. É uma cópia de uma página só, sem o `or(...)` das várias páginas. Não é o que `SecoesRepository.habilidadesDasPaginas` monta.
   - Consequência: o documento deixa sem bloco os termos `eq(materialId)`, `lte(paginaInicial)` e `gte(paginaFinal)` do SQL (`10_task.md:523`) porque "quem prova que ele usa o índice é o `EXPLAIN` da §7c". Esse `EXPLAIN` não lê o repository. Se alguém tirar o `or(...)` do SQL, todos os testes continuam verdes (o filtro em memória devolve a mesma saída), e a busca no caminho quente passa a ler todas as seções da escola.
   - Isso contraria o próprio `cenarios.md:276`, que atribui a "busca de verdade" à 10.0.
   - Correção exigida:
     - Expor o construtor da consulta e fazer o `EXPLAIN (format json)` de `.toSQL()`, como já faz `apps/api/test/semana-itens.int.test.ts:388`.
     - Usar várias páginas, como as 12 de `TRECHOS_NA_FERRAMENTA`.
     - Asseverar que o `Index Cond` de `secao_do_material_pagina_idx` cita `escola_id` e `material_id`.
     - Declarar o bloco de mutação que tira o `or(...)` do SQL.

2. **Cláusula nova sem bloco e sem teste em `DadoNominal.tsx`.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/governanca/DadoNominal.tsx:182`, `:183` e `:186`.
   - O que está errado: as três linhas tratam `habilidade: null`. A justificativa em `10_task.md:528` ("a tela não tem teste de unidade, é da 12.0") não é de mutante equivalente: sem o `?.`, a tela quebra com o `null` que a API passou a mandar nesta tarefa (`analista.int.test.ts` prova a linha `habilidade: null` no dado nominal).
   - A mesma correção mínima em `Analista.tsx`, `Aprovar.tsx`, `TurmaHoje.tsx`, `Atividade.tsx` e `ConteudoDoArtefato.tsx` ganhou teste e bloco nesta tarefa; só esta tela ficou de fora.
   - Correção exigida: um caso de unidade (ou de `Analista.test.tsx`, se ele abrir o dado nominal) com uma linha `habilidade: null`, que mostre o rótulo "Sem habilidade" e nenhum código. Depois, os três blocos de mutação, um por linha.

**Recomendações:**
- Faltam blocos para duas mutações que o `cenarios.md` pede. Pelo raciocínio sobre o código, os testes atuais pegariam as duas, mas o portão não as prova:
  - "tirar a conferência" (`cenarios.md:135`): tirar a chamada a `anularHabilidadesForaDaSecao` em `saveArtefato`, em `ferramentas.command.ts`;
  - "passar as habilidades" ao Tutor (`cenarios.md:146`, e a linha "entrada do Tutor" da tabela): trocar o `find` do Tutor por `findComHabilidades`.
- O item "Tutor" da linha `QUI.EM.05` cita `turno-do-tutor.test.ts › o trecho do Tutor é o { materialId, pagina, texto } estrito`, que não envolve `QUI.EM.05`. O Tutor não produz habilidade, e a memória de uma atividade antiga com `QUI.EM.05` é aceita (D82). Vale registrar isso como divergência, em vez de dar o item por coberto.
- "Virada do ano" (`geracao-pela-secao.int.test.ts:242`) só recua `classificada_em`. Não cria um ano letivo novo nem uma turma nele, então não exercita a turma do ano novo que o cenário descreve.
- O caso `aguardando`/`sem_habilidade` (`:134`) representa as duas seções só pela falta de linhas em `habilidade_da_secao`. Um caso com uma execução `pendente` de verdade sobre a seção provaria que a busca não depende do estado.
- O plano na integração (`:214`) só confere que as habilidades estão dentro da união; passaria com a lista sempre vazia. A união de fato está provada em `conteudo.test.ts`. Vale exigir ao menos uma habilidade quando o plano cita páginas das seções 3 a 6.
- "A habilidade de outra seção" (`:180`) depende da página que o adaptador falso escolhe para a primeira questão. Se ela citar a página 1 ou 2, o caso vira "página sem seção" e não "capítulo 7 com a do 3". Vale fixar a página citada.
- O caso do seed (`:327`) usa uma lista fixa de arquivos. Ler os arquivos por glob (em `e2e/support/**` e nas fixtures) evita que um seed novo fique de fora.
- `metricas.habilidadeAnulada` é emitida dentro da transação, antes de `ArtefatoRepository.create`. Se a transação voltar atrás, a métrica já somou. Vale emitir depois do commit, ou provar que isso não acontece na entrega dupla (D49).

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-20 01:52:01 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta rodada. As que a consulta lê seguem iguais: `secao_do_material` e `habilidade_da_secao` têm `escola_id`; `habilidade_bncc` é a tabela pública da BNCC, sem dono, que a regra 10 permite.

Queries verificadas: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts`:161, o método novo `consultaDasHabilidadesDasPaginas`, e o `habilidadesDasPaginas`, que agora o chama na linha 208.
- A consulta saiu do `habilidadesDasPaginas` para um método próprio sem mudar nada.
- A escola continua vindo do contexto autenticado (`requireEscolaId()`, linha 162) e nunca de parâmetro, no `where` e na junção (`habilidade_da_secao.escola_id = secao_do_material.escola_id`).
- O único chamador fora de teste continua sendo `trecho-search.ts`:104. O teste do `EXPLAIN` monta a consulta dentro de `comoPessoa`, ou seja, com o contexto de uma professora autenticada.
- Nenhum endpoint passou a receber `escolaId` do cliente.
- Nada nesta rodada toca id, mensagem de erro ou a camada de rede.
- `@Unscoped()` não aparece.

Teste de isolamento: presente e efetivo. O caso "a busca de A não alcança a seção de B" não mudou, e a mutação que tira o `where` da seção continua deixando-o vermelho. O outro caso só ganhou no nome a explicação de que quem prova o escopo da seção é o caso anterior, o que atende à recomendação da 1ª rodada. A premissa de que as páginas vêm do `find` agora está escrita no comentário do método (linhas 192 e seguintes); era a outra recomendação.

Bloqueantes: nenhum.

Recomendações:
- `secoes.repository.ts`:161: `consultaDasHabilidadesDasPaginas` é público e, com `paginas` vazio, o `or()` vira `undefined` e a consulta lê todas as seções classificadas da escola. Continua presa à escola do contexto, então não alcança outra escola. Hoje só o `habilidadesDasPaginas` a chama, e ele já devolve vazio antes quando não há página. Sugiro pôr a mesma guarda dentro do método novo, ou deixá-lo privado ao repository e expor só o `.toSQL()` para o teste.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-20 01:52:20 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff da 2ª rodada não toca `Nota`, a correção nem a aprovação do lote. Os caminhos auditados na 1ª rodada seguem iguais. Todos com autor humano: sim.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A geração continua nascendo pendente. A anulação da habilidade fora da seção (`ferramentas.command.ts`) agora tem bloco de mutação no `geracao-pela-secao.int.test.ts`.
Supervisão do tutor: ok. O diff não muda o tutor. O novo bloco de mutação em `apps/api/src/tutor/turno.command.ts` prova que a entrada do Tutor continua sem as habilidades da seção.
Autonomia declarada e visível: sim. O diff não muda a autonomia de nenhum agente.

Bloqueantes: nenhum.

O que conferi no diff (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-10_task-r2.txt`):
- **Recomendações da 1ª rodada:**
  - O teste de unidade de `DadoNominal.tsx` foi feito em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/governanca/Analista.test.tsx`. A linha sem habilidade aparece como "Sem habilidade", sem código nem descrição inventados, e tem três blocos de mutação nas linhas 182, 183 e 186 do componente. Rodei os dois arquivos de teste alterados nesta rodada: 40 casos, todos verdes.
  - Os seeds com código real da BNCC ao lado de descrição inventada e a anulação registrada só pela métrica `ia.habilidade_anulada` foram para o `TODO.md` com destino (12.0 e retro). Era o que eu tinha pedido.
- **Runbook, "Voltar o código depois da classificacao-bncc 10.0" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md`):** proíbe trocar o `null` por uma habilidade escolhida à mão e diz que "o diagnóstico não pode ganhar código que ninguém deu". Isso está de acordo com a regra 70: a volta da versão não fabrica habilidade nem diagnóstico. Se a volta for inevitável, as atividades com `null` ficam fora do alcance dos alunos, e o registro no `TODO.md` é só por contagem, sem dado de pessoa.
- **Teto de entrada** (`teto-de-entrada.ts`, `gerar-atividade-objetiva.ts`, `gerar-plano-de-aula.ts`, de 26.100 para 31.300 tokens) e o `EXPLAIN` lido do repository (`secoes.repository.ts`): são orçamento e desempenho, sem efeito sobre nota, aprovação ou supervisão.
- **Constante `MAXIMO_DE_HABILIDADES_DO_PLANO`:** só passou a viver em `packages/shared`, sem mudar o valor (6). O plano continua sem nota nem conceito.
- **D55, vigilância e indicador de professor:** nada no diff mexe em discursiva ou redação, em sinal sobre aluno ou em métrica de professor. O teste novo do Analista usa a abertura com finalidade (`apoio_a_aluno_em_risco`), que já era auditada.

Recomendações:
- No `e2e/professor-turma-alunos.spec.ts`, a varredura de acessibilidade do caso de ranking saiu porque o caso de 360 px da mesma aba já a faz. A prova de que não há palavra de nota nem de ranking continua no caso. Vale conferir na retro que o caso de 360 px abre a lista inteira, e não só o topo dela.
- As recomendações da 1ª rodada que ficaram no `TODO.md` continuam valendo: a auditoria de quais questões tiveram a habilidade anulada, e o seed com descrição inventada.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-20 01:52:53 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO

Perfis usados: sem mudança nesta rodada. `gerar_atividade_objetiva` e `gerar_plano_de_aula` seguem no perfil de geração. Nenhuma tarefa nova de modelo entrou. O Tutor não recebe as habilidades da seção, o que mantém a entrada dele no mínimo (regra 20, item 12).

Custo estimado por professor/mês: o teto de entrada das duas gerações subiu de 26.100 para 31.300 tokens (+20%). Esse é o pior caso reservado, não o consumo real. O pedido de uso comum continua bem abaixo do teto. A reserva de cada pedido dessas duas tarefas sobe na mesma proporção. O consumo real só cresce pelas habilidades da seção que vão ao prompt, até 5 por trecho. O custo real é cerca de 1 a 2 mil tokens por geração a mais, se a seção tiver habilidades. O teto de 31.300 é, em reserva, +20% por geração. A projeção de gerações por professor por mês continua sendo a da 1.0, sem número novo anexado a esta rodada.

Prompt versionado: sim. Os prompts continuam nos arquivos `prompts/gerar-*.ts`, e o diff desta rodada não os tocou.

Validação de schema: sim. O plano continua validado por `conteudoDePlanoDeAulaSchema`. `MAXIMO_DE_HABILIDADES_DO_PLANO` foi extraído para `packages/shared` e é a mesma constante no schema e no corte da tarefa (`gerar-plano-de-aula.ts:144`).

Aprovação humana no caminho: sim. A entrega nasce pendente e nada desta rodada muda isso.

Bloqueantes: nenhum. A correção exigida na rodada anterior foi feita pelo caminho (b), com a prova que faltava:
- `packages/core/src/ia/tasks/gerar-atividade-objetiva.ts:240` e `packages/core/src/ia/tasks/gerar-plano-de-aula.ts:96` passam o teto para 31.300. O pior pedido medido foi 31.184 na atividade e 31.203 no plano, então a sobra é de cerca de 0,3% e fica dentro dos 10%. Rodei `teto-de-entrada.test.ts`: 28 casos verdes, incluindo o que exige `teto >= pior` e `teto <= pior*1,1` em todas as tarefas.
- `packages/core/src/ia/teto-de-entrada.ts`: o gerador do pior pedido agora numera os itens das listas (`variacao`, "3." ou "11.4.") sem mudar o comprimento. Assim a união deduplicada de habilidades fica com 60 entradas. O teste já não passa sem cobrir o campo.
- `packages/core/src/ia/teto-de-entrada.test.ts`: o caso novo prova 12 trechos, 5 habilidades por trecho e uma união de 60. Há também um caso do texto curto demais para levar o número. As duas mutações do gerador estão registradas em `10_task.md`.
- Nenhum outro teto precisou subir: todas as tarefas seguem passando a mesma verificação com o gerador novo. O valor antigo, 26.100, só resta em `dist/`, que é artefato de build.
- A divergência e o novo teto estão documentados em `10_task.md` e no `techspec.md` §5.

O restante do diff é consolidação de teste e documentação. Nenhum desses itens fere a regra 30:
- O EXPLAIN agora lê a consulta real do repository (`consultaDasHabilidadesDasPaginas`, `.toSQL()`).
- O teste do dado nominal cobre a linha com habilidade `null`.
- O runbook ganhou o procedimento de rollback da 10.0.

Recomendações:
- Registrar a projeção de gerações por professor por mês com o delta de tokens. A 10.0 dispensa e manda para a 1.0, e eu aceito, mas a precificação continua sem esse número.
- Medir no painel o custo, em reexecuções, da habilidade inventada que repete por `IA_SAIDA_INVALIDA`. Já está no `TODO.md`, com destino 11.0 ou a retro.
- O pior pedido tem folga de apenas ~100 tokens sobre o teto. Qualquer campo novo no prompt vai quebrar o teste, o que é o comportamento desejado. Nesse caso, subir o teto exige revalidar a reserva de tokens.
- A soma de `ia.habilidade_anulada` dentro da transação dobra na reentrega (D49). Já está no `TODO.md`.

## pedagogia-reviewer · 2ª rodada · APROVADO · 2026-11-20 01:53:05 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO
Amostras avaliadas: 6 pontos do diff que o professor ou a aluna veem ou que protegem o que eles veem. São eles: o dado nominal com "Sem habilidade", o roteiro da demonstração, o runbook da volta de versão, a regra do plano com habilidade, o teto de entrada da geração e a consulta que busca a habilidade da seção.

Li o diff inteiro (742 linhas) e conferi cada correção exigida e cada recomendação da rodada anterior. Não rodei testes nem abri as telas. A rodada anterior não exigiu correção, só recomendações.

**Problemas por categoria**
- Nível, distratores, gabarito e tom: nada mudou nesta rodada. O gabarito e o enunciado gerados são os da rodada aprovada.
- Alinhamento curricular: melhorou.
  - A regra de que o plano cobre a união das habilidades das seções que cita agora é testada com `citadas.size > 0` e `plano.habilidades.length > 0`. Um plano que saísse sempre sem habilidade não passa mais.
  - O caso da atividade confere que a página citada é de uma seção que tem habilidade. Antes, uma habilidade qualquer seria anulada e o caso passava sem provar a conferência.
  - O teto do plano passou a vir de `MAXIMO_DE_HABILIDADES_DO_PLANO`, definido em `packages/shared/src/assistente/conteudo.ts`. Isso tira uma constante duplicada entre a tarefa e o schema.
- Telas: a linha sem habilidade do dado nominal da coordenação agora tem teste em `apps/web/src/areas/coordenacao/governanca/Analista.test.tsx:70-102`.
  - O teste confere que "Sem habilidade" aparece, que a linha não ganha código (só `EF07MA01` aparece) e que mostra "5 de 10".
  - Esse era o ponto que 4 revisores levantaram na 1ª rodada, e foi resolvido com três blocos de mutação.
- Roteiro da demonstração: era uma recomendação (o "2 min" do passo 1 não cabia com o item 3). `docs/roteiro-da-demonstracao.md` agora diz "4 min; 2 min sem o item 3" e marca o item 3 como opcional na versão curta, com a frase a dizer. Quem demonstra sabe o que cortar.
- Runbook da volta de versão (`docs/runbook.md`): o texto é claro e honesto sobre o que o professor e o aluno sofreriam.
  - Se a versão voltar para antes da correção de leitura, a aluna não abre a prova das atividades com `null` (erro 500).
  - O runbook proíbe trocar o `null` por uma habilidade inventada e apagar a questão. Isso protege o diagnóstico de ganhar um código que ninguém deu.
- Teto de entrada: subiu de 26.100 para 31.300 tokens nas duas tarefas de geração.
  - O pior pedido anterior repetia o mesmo valor em todos os itens de uma lista. A união das habilidades deduplicava em 5 e o teto passava sem cobrir o campo.
  - O gerador agora numera os itens ("0.", "1."…), e um caso prova a união de 60.
  - Isso protege o professor de uma geração recusada por estouro de teto em material com muitas habilidades.

**Exemplos concretos do que saiu errado**
Nenhum erro novo de conteúdo. Dois pontos pequenos, ambos recomendação:
- O título do teste em `Analista.test.tsx:70` diz que "Sem habilidade" vem "depois da que tem", mas nenhuma asserção confere a ordem. O teste confere só a presença do texto e a ausência de código.
- Em `e2e/professor-turma-alunos.spec.ts:153`, o caso "a lista não é ranking" perdeu a varredura de acessibilidade para caber nos 15 s do e2e.
  - A justificativa (o caso de 360 px da mesma aba já faz a varredura) está registrada nas Divergências da tarefa, e o `TODO.md` não precisa de entrada.
  - A varredura que ficou cobre a mesma aba, mas não o estado "ranking ausente".

**Ajuste sugerido no prompt ou na recuperação de contexto**
Nenhum. A busca da habilidade da seção segue presa à escola do contexto. A nota de premissa em `secoes.repository.ts` deixa claro que o método não confere estado nem licença do material: isso fica com `TrechoSearch.find`.

**Bloqueantes**
Nenhum. A ordem dos pousos (a correção de leitura de `null` pousa antes da classificacao-bncc) é dívida de processo registrada em `TODO.md` com dono. Não afeta o que a professora e a aluna veem nesta tarefa.

**Recomendações**
- Adicionar ao teste do dado nominal a asserção de ordem ("Sem habilidade" depois da linha com habilidade), ou tirar "depois da que tem" do título.
- A 12.0 deve fechar os itens de tela já registrados:
  - o plano sem habilidade que mostra o título "Habilidades" com a lista vazia;
  - a descrição da BNCC cortada em 300 caracteres;
  - o "Sem habilidade" sem explicação para a aluna.
- Os seeds do e2e usam código real da BNCC com descrição inventada. Conferir na 12.0 que o texto não aparece na demonstração.
- Migrar ou contar as atividades antigas com `QUI.EM.*` (11.0 ou retro).

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-10_task-r2.txt`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/governanca/Analista.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/roteiro-da-demonstracao.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-20 01:53:21 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA, prova, fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok

Bloqueantes: nenhum.

**A correção exigida na 1ª rodada (caminho a, "expandir antes de gravar") foi feita.**
- **Tech Spec §7c.** A linha "Migration" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/techspec.md:198`) foi reescrita. A leitura dos três formatos (`habilidade: null`, `habilidades: []`, `codigo: null`) vai numa correção própria, que não grava `null` e chega à `main` antes da classificacao-bncc. A promessa falsa ("a versão anterior lê … questão com `null`") saiu.
- **TODO.md.** A ordem dos pousos está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/TODO.md:4089`, com o Orquestrador como dono.
- **Runbook.** A seção "Voltar o código depois da classificacao-bncc 10.0 (rollback)" está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/runbook.md:1294`. Ela diz para onde voltar e diz que não se volta para antes da correção. Proíbe inventar habilidade. Também dá o que fazer se essa volta for inevitável.
- **O teste que a §7c promete existe nesta branch, pronto para ir com a correção.** Os leitores abrem os três formatos nestes casos:
  - `apps/api/src/atividade/correcao/correcao.int.test.ts:607`: o aluno responde a prova com questão `null`, e o lote, o desempenho e o diagnóstico dele saem com `codigo: null`.
  - `apps/api/test/geracao-pela-secao.int.test.ts:317`: a atividade com `null` e a com `QUI.EM.05` abrem para a professora. A linha 228 do mesmo arquivo lê o plano com `habilidades: []`.
  - `apps/api/src/governanca/analista.int.test.ts:321` e `:359`: o recorte e o dado nominal com a linha `habilidade: null`.
  - As telas, com `Analista.test.tsx` agora cobrindo o dado nominal.

**O resto do diff da 2ª rodada:**
- O `EXPLAIN` agora roda a consulta do próprio repository (`consultaDasHabilidadesDasPaginas().toSQL()`). Usa as 12 páginas da busca e 5.000 seções. Confere que a condição do índice cita `escola_id` e `material_id` e que não há leitura inteira da tabela `secao_do_material`. A mutação que tira o `or(...)` tem bloco.
- O teto de entrada das duas tarefas de geração passou para 31.300 tokens. O pior pedido medido dá 31.184 na atividade e 31.203 no plano, então a sobra fica bem abaixo dos 10%.
- O gerador do pior pedido agora monta itens distintos em cada lista, e um caso prova que a união chega a 60 habilidades. Rodei `teto-de-entrada.test.ts`: 28 casos passaram.

Recomendações:
- **Deploy separado.** A §7c, o runbook e o TODO dizem que a correção chega à `main` antes. Não dizem que ela precisa de um deploy de produção só dela. Se as duas entrarem no mesmo merge de `release`→`main`, a volta cai para antes da correção, e a prova das atividades com `null` não abre. Vale escrever isso na linha do TODO e no runbook.
- **A ordem é só um item do TODO.** Ela não é uma trava do pouso. Vale o Orquestrador recusar o pedido de pouso da classificacao-bncc enquanto a correção não estiver na produção.
- **Reserva de tokens.** A reserva de cada pedido de geração sobe cerca de 20%, junto com o teto. Vale ver no painel se o limitador da escola começa a adiar gerações no pico.
- **Já registradas no TODO, ficam como estão:** a métrica `ia.habilidade_anulada` soma dentro da transação e conta de novo na reentrega, e as atividades antigas com `QUI.EM.*` não foram migradas.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-20 01:54:00 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Esta rodada mexe na consulta das habilidades da seção (material e BNCC), no teto de entrada das duas tarefas de geração, em testes, em docs e no runbook. Nenhuma coluna, DTO ou campo de pessoa mudou.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- O método novo `consultaDasHabilidadesDasPaginas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:161`) pega a escola do contexto com `requireEscolaId()`, não de um argumento. A junção com `habilidade_da_secao` continua presa a `escola_id`.
- `habilidadesDasPaginas` agora só chama esse método. O escopo de antes não mudou.
- O teste de isolamento entre as escolas A e B (`geracao-pela-secao.int.test.ts`) continua no lugar.

Logs: limpos. A rodada não acrescenta log. Os dois passos novos do runbook ("Voltar o código depois da classificacao-bncc 10.0") pedem para registrar só contagens no `TODO.md`.

Auditoria: presente. Nenhuma ação nova pede auditoria nesta rodada. A métrica `ia.habilidade_anulada` ainda não diz quais questões tiveram a habilidade anulada. Isso está no `TODO.md` para a retro, como na 1ª rodada.

Envio externo:
- `gerar_atividade_objetiva` e `gerar_plano_de_aula` mandam só material da escola e habilidades da BNCC (`categoriasEnviadas: ['material_da_escola']`, `levaTextoLivreDePessoa: false`, `levaTextoDeAluno: false`). Nada disso mudou.
- O teto de entrada subiu de 26.100 para 31.300 tokens para caber a união de 60 habilidades. É texto público da BNCC, não dado de aluno.
- O envio continua passando pelo gateway e fica registrado em `ExecucaoAgente`. O Tutor continua sem receber as habilidades da seção.

Seed/fixture: sintético. O teste novo de `Analista.test.tsx` usa "Professora Sintética", ids fictícios e códigos da BNCC. O teste de `EXPLAIN` semeia 5.000 seções sem dado de pessoa, dentro de uma transação que é desfeita no fim.

Correções exigidas na rodada anterior: nenhuma. Das duas recomendações:
- O teste do `DadoNominal.tsx` com `habilidade: null` foi feito. Ele está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/governanca/Analista.test.tsx`, com três blocos de mutação nas linhas 182 a 186 do `DadoNominal.tsx`. Ele confere que a linha sem habilidade aparece como "Sem habilidade", sem código.
- A migração das atividades antigas com `QUI.EM.*` não foi aplicada. Ficou para a 11.0 ou para a retro, e o texto mantém a ressalva de que nenhuma correção aprovada muda sem passar pela auditoria de alteração de nota.

Pergunta de fechamento: esta rodada não muda nada do que o sistema guarda sobre um aluno nem para onde isso vai. O arquivo do titular e o registro em `ExecucaoAgente` respondem como na rodada aprovada.

Bloqueantes: nenhum.

Recomendações:
- `secoes.repository.ts:161`: `consultaDasHabilidadesDasPaginas` é público, mas a proteção contra lista vazia está só em quem o chama (`habilidadesDasPaginas`). Com `paginas = []`, o `or()` vira `undefined` e a consulta lê todas as seções da escola do contexto. Não vaza para outra escola nem dado de pessoa, mas vale tornar o método privado ou repetir a proteção dentro dele.
- `secoes.repository.ts:63-64`: o próprio comentário diz que `habilidadesDasPaginas` não confere se o material foi excluído nem a licença. Vale manter isso preso à `TrechoSearch.find`, com teste ou com o método privado, para que ninguém chame com páginas de outra origem e leia a classificação de material excluído.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-20 01:54:24 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência no `cenarios.md`, seção "Geração e Tutor" (o caso do Tutor com `QUI.EM.05`)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

**A correção exigida na rodada anterior foi feita.** `cenarios.md:140-141` agora diz que a questão cita uma página só, que escolhe entre as habilidades da seção dessa página (ou fica `null`) e que a união das seções vale para o plano. A linha 48 da tabela de testes de `10_task.md` não cita mais "questão que cita dois".

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md:143`. É o mesmo problema da rodada anterior, num caso novo: a divergência ficou registrada só na tarefa.
  - **O que a tarefa diz:** nesta rodada, `10_task.md:85` ganhou uma divergência. O Tutor não tem caso de recusa de `QUI.EM.05`, porque não produz habilidade. O `QUI.EM.05` que vem da memória de uma atividade antiga é aceito (D82).
  - **O que o cenário ainda diz:** a coluna "Onde está na spec" dessa divergência aponta para `cenarios.md:143`. Essa linha não foi alterada e continua prometendo "Cada saída recusa `QUI.EM.05` vindo do `ScriptedAdapter` ou o anula: atividade, plano, adaptação, Tutor (memória)". O cenário diz que recusa ou anula; a tarefa diz que aceita.
  - **Consequência:** a linha `QUI.EM.05` da tabela de testes (`10_task.md:50`) continua listando o Tutor com "recusado ou anulado, um caso cada", e esse caso nenhum teste cobre.
  - **Correção exigida:**
    1. Reescrever `cenarios.md:143` sem o "Tutor (memória)" na lista de saídas que recusam ou anulam. Acrescentar que o Tutor não produz habilidade, que a memória com `QUI.EM.05` de atividade antiga é aceita (D82) e que o caso do Tutor é o da linha seguinte (a entrada sem as habilidades da seção).
    2. Na linha 50 da tabela de testes, tirar o Tutor da coluna de cenário. Ele fica na linha "entrada do Tutor".

Recomendações:
- **O pouso da classificacao-bncc depende de uma correção que ainda não existe.** A volta da versão (o rollback) só funciona se a correção da leitura pousar antes: `techspec.md` §7c, `docs/runbook.md`, "Voltar o código depois da classificacao-bncc 10.0", e `TODO.md`. A ordem está registrada no `TODO.md`, com o Orquestrador como dono. Vale que ele confira, no momento do pouso, que a correção já está na `main`. Sem ela, o rollback do runbook leva a uma versão que não lê o que a 10.0 gravou.
- **Teto de entrada (`teto-de-entrada.ts`):** a numeração dos itens de lista agora vale para toda tarefa do catálogo, e o pior pedido das outras tarefas pode ter mudado. O portão passou, mas vale citar nas Divergências que os tetos das outras tarefas continuaram cobrindo o pior pedido.
- **`Analista.test.tsx`:** o teste troca `showModal` e `close` do `dialog` no `beforeEach` e não os restaura. As outras nove telas fazem igual, então não é um segundo jeito de fazer; só registro.

## test-engineer · 2ª rodada · APROVADO · 2026-11-20 01:54:31 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO

**Cenários exigidos.** Esta é a 2ª rodada, sobre o diff r1 para r2. As duas correções que exigi na 1ª:
1. O `EXPLAIN` tem de ler a consulta do repository, com várias páginas, e ter um bloco de mutação que tira o `or(...)`.
2. O `DadoNominal.tsx` com `habilidade: null` precisa de um caso de unidade e de três blocos, um por linha.

Entram também as mudanças novas do diff: o gerador do pior pedido com itens distintos, o teto de 31.300, o plano com ao menos uma habilidade e a página citada de seção com habilidade.

**Cobertos.**
- **Correção 1, feita.** A consulta saiu para `SecoesRepository.consultaDasHabilidadesDasPaginas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:35`), e `habilidadesDasPaginas` passou a usá-la (`:208`).
  - O teste roda o `EXPLAIN (format json)` sobre o `.toSQL()` dessa consulta, dentro de `comoPessoa`, com as 12 páginas de `TRECHOS_NA_FERRAMENTA` e 5.000 seções (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/geracao-pela-secao.int.test.ts:360-376`).
  - Ele confere que o índice `secao_do_material_pagina_idx` é usado, que a condição do índice cita `escola_id` e `material_id`, e que não há leitura inteira da tabela de seções.
  - O bloco que tira o `or(...)` está declarado. Tirar só o `eq(materialId)` também deixa o caso vermelho, pela condição do índice.
- **Correção 2, feita.** O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/governanca/Analista.test.tsx:70` abre o dado nominal de verdade: diálogo, turma, finalidade. Ele recebe uma linha com `habilidade: null` e confere duas coisas:
  - aparece "Sem habilidade" com "5 de 10";
  - só existe um código `EF07MA\d+` na tela.

  Cada um dos três blocos (`key`, `rotulo`, `detalhe`) faz a tela quebrar com `null`, e é exatamente essa a regra que as três linhas guardam.
- **Teto de entrada.** O caso novo prova que, no pior pedido das duas tarefas de geração, a união das habilidades é de 60, e não 5 deduplicadas. O caso do texto curto cobre o ramo em que o número do item não cabe. Cada um tem o seu bloco.
- **Recomendações da 1ª rodada.**
  - Aplicadas: o plano exige ao menos uma habilidade e usa `MAXIMO_DE_HABILIDADES_DO_PLANO`; a página citada tem de ser de seção com habilidade; há blocos para "tirar a conferência" e "passar as habilidades ao Tutor"; a divergência do Tutor com `QUI.EM.05` está registrada.
  - Anotadas no `TODO.md`, com destino: virada do ano, `aguardando` com execução pendente, seed por glob e a métrica dentro da transação.
- **O que rodei.** `npx vitest run` nos dois testes de unidade passou com 40 de 40. O `geracao-pela-secao.int.test.ts` passou com 16 de 16. O `mutacoes.ts --faltando` lista 4 linhas, e todas têm motivo de mutante equivalente no documento: os dois guardas de lista vazia, o `item.codigo === null` do Tutor e o `has` da união.

**Bloqueantes:** nenhum.

**Recomendações (não bloqueiam):**
1. A condição do índice não confere `pagina_inicial` (`geracao-pela-secao.int.test.ts:375`). Se alguém tirar só o `lte(paginaInicial)` do `or`, o índice continua sendo usado, mas lê o material inteiro, e o caso fica verde. Basta trocar a expressão por `/escola_id.*material_id.*pagina_inicial/`.
2. O nome do caso em `Analista.test.tsx:70` diz "depois da que tem", mas nada confere a ordem das duas linhas. Ou se acrescenta a asserção (o índice de "EF07MA01" menor que o de "Sem habilidade"), ou se tira isso do nome.
3. Em `e2e/professor-turma-alunos.spec.ts:153`, a varredura de acessibilidade saiu do caso que roda em tela de computador. A única que sobrou é a do caso de 360 px (`:243`), onde a lista vira linhas. A tabela da tela de computador ficou sem varredura. Sugiro levá-la para o caso de 1366 × 768 (`:218`), que já abre a aba.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-20 02:19:42 · `tasks/prd-classificacao-bncc/10_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As duas correções da 2ª rodada foram feitas, e nenhum código mudou desde então.

1. **`cenarios.md:143`:** o cenário agora lista só atividade, plano e adaptação como saídas que recusam ou anulam `QUI.EM.05`. Ele diz que o Tutor não produz habilidade, que o `QUI.EM.05` vindo da memória de uma atividade antiga é aceito (D82) e que o caso do Tutor é o da linha seguinte. Cenário e tarefa (`10_task.md:85`) dizem a mesma coisa.
2. **`10_task.md:50`:** o Tutor saiu da linha do `QUI.EM.05`. A linha "entrada do Tutor" (`10_task.md:51`) passou a I, U e ganhou os dois casos: `tutor-modelo.int.test.ts` e `turno-do-tutor.test.ts:1093`. O nome deste último confere com o que a tarefa cita.

A recomendação que a ordem mandou aplicar também está feita. A linha do teto nas Divergências cita que os tetos das outras tarefas continuaram cobrindo o pior pedido, e aponta para o caso `teto-de-entrada.test.ts:19`, que roda para cada tarefa do `TASK_CATALOG`.

As linhas novas do `TODO.md` e a tabela "Sem aplicar" da 2ª rodada só registram recomendações. Nada novo ficou só na tarefa.

Recomendações:
- `tasks/prd-classificacao-bncc/10_task.md:85`: a coluna "Onde está na spec" ainda descreve a linha do cenário como "que lista o Tutor pela memória". Ela não lista mais o Tutor assim. Atualizar a descrição para a redação nova ("o Tutor não produz habilidade… o caso do Tutor é o da linha seguinte").

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/10_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/TODO.md
