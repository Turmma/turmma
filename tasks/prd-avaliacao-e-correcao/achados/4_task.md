# Achados das revisões — `tasks/prd-avaliacao-e-correcao/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-24 02:44:50 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta tarefa. A coluna `tentativa_atividade.ordem` (jsonb) já existia desde a 1.0, em `packages/core/src/db/schema/tentativa-atividade.ts:40`. A tabela tem `escolaId` e `anoLetivoId`. A coluna guarda só posições numéricas, sem texto e sem dado de pessoa.

Queries verificadas:
- `MinhaAtividadeRepository.embaralhar(id)` (`minha-atividade.repository.ts:235-241`): usa `#daMinhaTurma()`, que aplica `escolaId` e `anoLetivoId` do contexto e confere o vínculo do aluno da sessão com a turma. O id da aplicação é só um filtro a mais. O service só a chama depois de `prova()` achar a aplicação.
- `MinhaAtividadeRepository.comecar(...)` (`:267-272`): `escolaId`, `anoLetivoId` e `alunoId` vêm de `requireEscolaId()`, `requireAnoEmCurso()` e `requestSessao()`. A `ordem` é sorteada no servidor e não vem do cliente. `on conflict do nothing` com a chave que começa pelo escopo.
- `tentativa(id)` com a coluna nova `ordem` (`:275-278`): usa o escopo `#minha`, que já existia, por escola, ano e aluno da sessão.
- Nenhum endpoint novo. Nenhum `escolaId` chega do corpo ou da query. Nenhum `@Unscoped()`. Os ids continuam UUID. A tarefa não toca a camada de rede.

Teste de isolamento: presente e efetivo.
- O caso "isolamento: o repository só lê" (`apps/api/src/atividade/embaralhamento.int.test.ts:300-317`) chama `embaralhar` com quatro contextos: o aluno da outra escola, a escola trocada, o ano trocado e o aluno de outra turma da mesma escola. Nos quatro espera `undefined`. Se a cláusula `#daMinhaTurma()` for removida, a leitura passa a devolver `{questoes, alternativas}` e o teste quebra. A tarefa declara essa mutação.
- O caso "o alcance vem antes do sorteio" (`:280-298`) prova que o aluno de outra turma recebe `NAO_ENCONTRADO` tanto no `comecar` quanto em `prova`. Prova também que não nasce tentativa e que o sorteador não é consumido. A resposta é igual à de id inexistente, então não revela que o dado existe.

Bloqueantes: nenhum.

Recomendações:
- `embaralhar(id)` repete o alcance de `prova()` numa segunda leitura, que não leva a trava `for share`, dentro da mesma transação. A separação está justificada no docblock pelo limite de 1 kB do `pg_stat_activity`. Quando o teste da trava deixar de depender do texto da query, vale juntar as duas leituras numa só para eliminar a duplicação do escopo.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-24 02:45:09 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

A tarefa 4.0 não cria campo pessoal novo, não registra nada em log e não envia dado para fora. A coluna da ordem da prova já existia, guarda só números de posição e já faz parte do mapa de dados e do arquivo do titular. O pedido de leitura da aplicação que entrou nesta tarefa usa o mesmo filtro de escola, ano e turma do aluno que a leitura da prova.

Campos pessoais tocados: `tentativa_atividade.ordem`, a ordem em que aquele aluno vê as questões e as alternativas. Guarda só posições, sem texto e sem pessoa, e o esquema estrito de `apps/api/src/atividade/minha-atividade/ordem-da-prova.ts` recusa qualquer campo a mais. A resposta da prova ganha `ordemDasAlternativas`, que traz só índices de alternativa e não diz nada sobre o aluno.

Fora da tabela de dados do docs/lgpd.md: nenhum. A linha 59 de `docs/lgpd.md` ("Tempo da prova online") já cobre "a ordem embaralhada das questões e alternativas", com finalidade e retenção. Além disso:
- `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts:1305` registra a coluna `ordem` entre as que guardam dado estruturado, só números.
- A coluna sai na eliminação do aluno e no expurgo do trabalho do aluno.

Autorização por objeto: ok.
- **`embaralhar(id)`**, em `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:235-241`, filtra por escola e ano vindos da sessão e por vínculo do aluno na turma. É o mesmo filtro de `prova`, e só roda depois que `prova` achou a aplicação.
- **Troca de id na URL:** um aluno de outra turma recebe `NAO_ENCONTRADO` antes do sorteio. O caso "o alcance vem antes do sorteio" em `embaralhamento.int.test.ts` prova isso: o sorteador não é chamado e nenhuma tentativa nasce.
- **Gravação da tentativa:** a `ordem` é gravada com o `alunoId` da sessão, nunca com um id vindo do cliente.
- **Isolamento:** um caso chama o repository direto com escola, ano e turma trocados e não lê nada.
- **O que vai para o aluno:** o esquema estrito da questão continua barrando gabarito, explicação, habilidade e citação. O `atividade.int.test.ts` confere que a questão tem exatamente as chaves esperadas, agora com o campo novo.

Logs: limpos. Nenhum log foi acrescentado. As mensagens de `InvariantException` ("ordem da prova inválida", "não bate com a atividade") não trazem dado de pessoa nem conteúdo da prova.

Auditoria: não se aplica. O aluno lê a própria prova, e não há leitura pela coordenação ou pela rede, exportação, nota, permissão nem saída de IA.

Envio externo: nenhum. O sorteio é `crypto.randomInt`, feito localmente.

Seed/fixture: sintético. Os alunos dos testes são "Aluna Sintética Ana/Bia" e "Aluno Sintético Caio", e as questões dos fixtures são inventadas.

Pergunta de fechamento: o código responde. `packages/core/src/titular/leitura-do-titular.ts:313` inclui `ordem` na leitura de `tentativa_atividade` do arquivo do titular. Nada desta tarefa sai do sistema.

Bloqueantes: nenhum.

Recomendações:
1. Em `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:637-638`, se `embaralhar(id)` voltar vazio, o erro sai como falha interna (`InvariantException`), não como "não encontrado". A tarefa diz que esse caminho não acontece, porque a aplicação já está travada na mesma transação. Se um dia acontecer, o cliente recebe uma resposta diferente de "não encontrado". Vale deixar escrito no comentário que esse caminho não acontece.
2. A tarefa 12.0, que vai ajustar a tela, deve continuar sem nada que revele a ordem de um aluno a outro. Ela só deve usar `ordemDasAlternativas` para mandar o índice original da alternativa. O bug que a própria tarefa já aponta, de a tela de hoje marcar errado uma prova embaralhada, é de correção da nota e não de privacidade. Fica com o `conformidade-reviewer` e com a 12.0.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-24 02:45:16 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

Escopo: respeitado. Os itens 4.1 a 4.3 estão feitos. A web só mudou nas fixtures, como o documento prevê, e a tela continua para a 12.0, que o documento cita na seção "Fora do escopo".

Aderência à Tech Spec: ok. A divergência do campo `ordemDasAlternativas` está registrada em quatro lugares: no parágrafo da `techspec.md` §4, no detalhe da `ordem` na §5.3, na linha nova do RF8 no `cenarios.md` e no `docs/mvp-contratos.md`. O código segue o que a §5.3 descreve:
- o sorteio vem depois do alcance, da janela e do estado;
- a `ordem` é nula quando a aplicação não embaralha, e então o sorteador nem é chamado;
- com `on conflict do nothing`, só a ordem da primeira chamada fica gravada.

O caso (a) do `cenarios.md` §3 tem teste com `WriteBlockTrigger`.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- **Duas leituras do mesmo conteúdo no `comecar`.** Em `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:207`, `#ordemDeQuemComeca` passa o `prova.conteudo` por `conteudoDeAtividadeSchema.parse` só para contar as questões, e `#emAndamento` (linha 160) faz a mesma leitura logo depois. Basta ler uma vez no `comecar` e passar o total de questões ao método.
- **Consulta a mais no começo da prova.** Em `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:134`, `embaralhar(id)` faz uma consulta separada, repetindo o alcance de `prova`. O motivo está escrito: o limite de 1 kB do `pg_stat_activity` e o teste da trava que acha a consulta por um trecho do fim do texto. Mesmo assim, ela só existe por causa de como o teste encontra a consulta. Vale registrar na retro para trocar esse jeito de achar a espera, em vez de deixar o teste moldar o repository.
- **A ordem lida do banco é validada em duas funções.** Em `apps/api/src/atividade/minha-atividade/ordem-da-prova.ts:25`, `ordemDaProvaSchema` não confere se `alternativas.length` é igual a `questoes.length`, e quem confere é `naOrdemDoAluno` (linha 68). Um `.refine` no próprio esquema faria `readOrdem` recusar sozinha toda ordem incoerente, e a guarda de tamanho ficaria num lugar só.
- **Risco até a 12.0.** A tela de hoje manda o índice da posição na tela, então uma prova com "embaralhar" ligado seria corrigida errado até a 12.0 entrar. O documento registra isso, e a spec só pousa inteira. Na validação, confirme que nenhuma linha leva esta spec à `develop` antes da 12.0.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-24 02:45:17 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo. A tarefa grava só `tentativa_atividade.ordem` no `comecar`. Nos testes, a nota continua nascendo por `aprovarOLote` da professora (`embaralhamento.int.test.ts:156`, `:170`, `:200`). Todos com autor humano? sim.

Decisão autônoma sobre aluno: ausente. O sorteio decide só a ordem em que as questões e alternativas aparecem. A resposta guarda o índice original, e a correção, o diagnóstico e o desempenho seguem pela ordem original. O teste prova isso: acerto 5/5 nos dois alunos e o mesmo resultado por habilidade.

Aprovação registrada: ok. A tarefa não cria saída de IA nova e não mexe no lote, que continua pendente até a aprovação.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente ganhou ou mudou de nível.

Pontos 7 a 9 da auditoria:
- **Vigilância (item 7):** a `ordem` guarda só posições e números (`ordem-da-prova.ts`, `ordemDaProvaSchema`). Não tem texto, comportamento nem inferência, e fica na tentativa, já classificada como trabalho do aluno.
- **Discursiva e redação (D46, D55):** nada novo. O embaralhamento vale só para objetiva com 4 alternativas.
- **Professor (D45):** nenhuma métrica ou visão sobre o professor.

Bloqueantes: nenhum.

Recomendações:
1. **Levar o aviso da 4.0 para dentro de `tasks/prd-avaliacao-e-correcao/12_task.md`.** Hoje o aviso só existe em `tasks/prd-avaliacao-e-correcao/4_task.md:83` (Fora do escopo). A 12.0 cita "Depende de: 4.0", mas nenhuma subtarefa nem linha de teste cobre `ordemDasAlternativas`. A tela de hoje faz duas leituras pela posição:
   - `apps/web/src/areas/aluno/Atividade.tsx:113` acha a questão por `prova.questoes[numero - 1]` e manda o índice da posição na tela.
   - `apps/web/src/areas/aluno/Atividade.tsx:336` mostra as alternativas na ordem da tela, mas o índice que lê é o original.

   A professora já consegue ligar "embaralhar" (`apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx:176-190`). Se a 12.0 esquecer esse mapeamento, o aluno que marca a certa recebe "errado". A professora vê a correção já errada ao aprovar o lote, e a nota sai com autor humano mas valor errado. Sugestão: uma subtarefa na 12.0, mais um caso web em que o aluno marca a certa numa prova embaralhada e o `PUT` leva `ordemDasAlternativas[posicao]`, com a questão achada por `numero`. A spec só pousa inteira, por isso não bloqueia agora.
2. **Na 12.0, conferir o diagnóstico do aluno com a prova embaralhada.** Ao mostrar "sua resposta" e "a certa" depois da aprovação, o texto exibido tem de ser o do índice original, senão a devolutiva mostra a alternativa errada.

Arquivos lidos:
- `apps/api/src/atividade/minha-atividade/ordem-da-prova.ts`
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts`
- `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts`
- `apps/api/src/atividade/embaralhamento.int.test.ts`
- `packages/shared/src/atividade/prova.ts`
- `tasks/prd-avaliacao-e-correcao/12_task.md`

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-24 02:45:46 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: prova
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok

Bloqueantes:
- `tasks/prd-avaliacao-e-correcao/12_task.md:20-28` e a tabela de testes a partir da linha 45.
  - **O que está errado:** a 4.0 passa a devolver a prova embaralhada. A tela de hoje manda o índice da posição na tela (`apps/web/src/areas/aluno/Atividade.tsx:190-196`, com o comentário "a ordem delas não muda", que ficou falso). O mapa e o diagnóstico depois do envio (`Atividade.tsx:336-338`) leem as alternativas pela posição.
  - **Consequência:** numa avaliativa com "embaralhar" ligado, o servidor grava a alternativa errada sem avisar ninguém, e o aluno é corrigido errado. É a regra 80, item 6, e a RF8 quebradas na ponta. O professor já liga o embaralhamento em `AplicacaoDoArtefato.tsx`.
  - **O aviso não chegou a quem resolve:** ele está só em "Fora do escopo" da `4_task.md:83`. A `12_task.md`, que fecha o assunto, não fala de `ordemDasAlternativas` nem de embaralhamento: não há subtarefa, linha de teste nem caso no e2e. Também não lista `Atividade.tsx` entre os arquivos previstos.
  - **Correção exigida:**
    - Na `12_task.md`, uma subtarefa para a tela da prova achar a questão por `numero` e mandar `questao.ordemDasAlternativas[posicao]` como `alternativa`.
    - Na mesma subtarefa, o mapa das questões e o diagnóstico lidos pelo índice original.
    - Uma linha na tabela de testes: prova com sorteio conhecido, a certa marcada numa posição de tela diferente da original, e o `PUT` leva o índice original. O que distingue é mandar a posição da tela.
    - Um caso em `e2e/aluno-prova.spec.ts` com uma aplicação embaralhada.
    - O comentário de `Atividade.tsx:193` corrigido ou marcado para a 12.0.

Recomendações:
- O `questaoDaProvaSchema` é estrito, e a web valida a resposta com ele (`apps/web/src/api/atividades-do-aluno.ts:45` e `:59`). Uma aba aberta com o bundle anterior recusa a `prova` que traz `ordemDasAlternativas`. Como a prova online pode acontecer em qualquer horário, registre no runbook do deploy desta spec que a aba aberta precisa recarregar. Uma alternativa é a web tolerar campo a mais nessa leitura.
- O `comecar` ficou com uma ida a mais ao banco (`embaralhar(id)`): é uma consulta só, pela chave primária, e só quando a tentativa ainda não existe. O custo é desprezível com 35 alunos começando juntos. Se um dia o texto da consulta `prova` encolher, junte as duas consultas.

## test-engineer · 1ª rodada · APROVADO · 2026-11-24 02:46:01 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** com sorteio fixo, dois alunos recebem ordens diferentes e conhecidas, e os dois acertam pelo índice original.
- **Casos de borda:** só as alternativas embaralham; só as questões embaralham; nada embaralha; a retomada, que cobre a queda de rede (o aluno começa de novo, relê a prova e relê depois de responder).
- **Correção pela ordem original:** o desempenho por habilidade e o diagnóstico ficam iguais aos da ordem original.
- **Concorrência:** clique duplo em "começar", com duas chamadas em paralelo.
- **Permissão:** o aluno de outra turma recebe NAO_ENCONTRADO antes do sorteio.
- **Isolamento:** a leitura de `embaralhar(id)` com outra escola, outro ano, outra turma e outra aplicação da mesma turma.
- **Contrato:** `ordemDasAlternativas` é uma permutação dos quatro índices.
- **Dado gravado corrompido:** cai em InvariantException.

**Cobertos:** todas as 11 linhas da tabela de testes têm o seu caso, citado pelo nome em `apps/api/src/atividade/embaralhamento.int.test.ts`, `apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts` e `packages/shared/src/atividade/atividade.test.ts`. A linha nova do `cenarios.md` ("o aluno que escolhe pelo texto manda esse índice") está coberta pelo `responderComoATela` do caso "sorteio fixo, dois alunos".

O que conferi:
- **Mutações:** `mutacoes.ts --faltando` diz "Nenhuma linha nova de produção com condição fica sem bloco". Os motivos dados para as cláusulas sem bloco se sustentam:
  - os dois termos de `original/posicoes === undefined` só são indefinidos juntos, e a guarda inteira tem bloco;
  - a guarda de `embaralhar === undefined` tem bloco com a condição invertida.
- **Cada bloco cai no ponto certo.** Por exemplo:
  - a remoção do termo `ordem.alternativas.length` só fica vermelha pelo 4º `expect` (quatro ordens para três questões), e ele existe;
  - a remoção do `id` no `where` de `embaralhar` faz as duas leituras devolverem a mesma linha, e uma das duas asserções cai.
- **Asserções sobre o resultado:** a ordem é lida do banco (`select ordem`) e da resposta da API. O que fica gravado é `resposta_atividade.alternativa` igual ao gabarito. A correção é lida pelo diagnóstico do aluno e pelo desempenho da turma, medido pela diferença antes e depois.
- **Concorrência de verdade:** o `WriteBlockTrigger` roda por padrão depois do insert (`after`), então a linha já está no índice único e a segunda chamada espera de fato na chave. O teste confere que o roteiro da segunda foi consumido, e a mutação para `onConflictDoUpdate` deixa o caso vermelho.
- **Nada desligado:** não há `.skip`, teste comentado nem mock que esconda a regra. O sorteador injetado é a entrada da regra, não a regra. A tarefa não tem IA.
- **Sem depender do acaso:** os dois testes com `crypto.randomInt` real só afirmam coisas que valem para qualquer sorteio. A chance de faltar um valor entre 400 sorteios é desprezível.
- **Execução:** a unidade e o shared passaram (40 de 40). O teste de integração não rodou aqui: o setup recusou subir a infra porque havia workers de job de pé no ambiente (`recusarJobDePe`). Isso é do ambiente e não do teste, e o portão da tarefa já provou as mutações.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O aviso para a 12.0 só está no "Fora do escopo" desta tarefa (`4_task.md:83`). O `tasks.md:69-76` e o `12_task.md` não dizem nada sobre achar a questão por `numero` nem sobre mandar `questao.ordemDasAlternativas[posicao]`. Vale registrar na 12.0 um cenário de unidade ou de e2e que fique vermelho se a tela mandar a posição da tela. Sem isso, a tela de hoje marca errado toda prova embaralhada, e só a memória de alguém segura o problema.
2. A `techspec.md` §5.3 afirma que "o sorteio vem depois do alcance, da janela e do estado", mas só o alcance tem caso. Um caso de "começar" fora da janela e outro com a atividade encerrada, conferindo que o roteiro ficou intacto, fecham a frase.
3. Nenhum teste prova que, sem injeção, o módulo usa o `sorteadorDeProducao` (o lado `??` do `atividade.module.ts:61`). Hoje isso só aparece de forma indireta, se outro teste de integração começar uma prova embaralhada sem sorteador injetado.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-26 16:01:25 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta rodada. A `atividade_aplicada` e a `tentativa_atividade` (com a coluna `ordem`) não mudaram desde a 1ª rodada, e as duas têm `escolaId` e `anoLetivoId`.

Queries verificadas: o `minha-atividade.repository.ts` não mudou nesta rodada. O `prova(id, true)` e o `embaralhar(id)` continuam filtrando por `requireEscolaId()`, `requireAnoEmCurso()`, a turma do aluno e o id, e o aluno sai da sessão (`requestSessao().usuarioId`). Nenhum parâmetro do cliente decide o escopo. No `minha-atividade.service.ts`, a mudança só faz o `conteudo` ser lido uma vez: ele é lido depois de `prova === undefined` responder `NAO_ENCONTRADO`, e assim o conteúdo nunca é lido antes de o alcance ser confirmado. A ordem de alcance, janela, estado e sorteio continua a mesma. O comentário novo diz que a guarda `InvariantException` de `embaralhar` não chega ao aluno, e isso não abre caminho para revelar que uma aplicação de outra escola existe, porque o caminho de fora do alcance já parou antes, em `prova()`. O comentário de `Atividade.tsx` só troca texto.

Teste de isolamento: presente e efetivo. O caso "isolamento: o repository só lê..." não mudou desde a rodada aprovada. O caso novo, "o sorteio vem depois da janela e do estado", testa a ordem das checagens e não o tenant. Ele confere `PROVA_FORA_DA_JANELA` e `ATIVIDADE_ENCERRADA`, que não haja tentativa e que o roteiro do sorteador fique intacto, e com isso fecha o caminho em que o sorteio ou a tentativa acontecem antes da recusa.

Correções exigidas da 1ª rodada: nenhuma, então não há o que conferir.

Bloqueantes: nenhum

Recomendações: nenhuma nova. A da 1ª rodada, juntar `embaralhar(id)` e `prova()` numa leitura só, continua com destino de retro, como está registrado em `tasks/prd-avaliacao-e-correcao/4_task.md`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-26 16:01:40 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. A rodada 2 não mexe em `Nota`, em `Correcao` nem em lote, e `apps/api/src/atividade` não tem escrita em `notas` nem `lancadaPor` fora de teste. Todos com autor humano? sim, sem mudança desde a rodada 1.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. O diff não traz nenhuma saída de IA nova. O embaralhamento é um sorteio feito pelo servidor, sem modelo, e só muda a ordem em que a prova aparece.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim. Nada mudou na governança nem nos agentes.

Bloqueantes: nenhum.

O que conferi nesta rodada:
- **`minha-atividade.service.ts`:** o `conteudo` agora é lido uma vez no `comecar`. Isso não muda a regra: o alcance (`prova(id, true)`) continua vindo antes, e a janela e o estado continuam vindo antes do sorteio. O docblock novo explica que a guarda `embaralhar === undefined` cai como `InvariantException` e não volta ao aluno como resposta, o que está certo.
- **`embaralhamento.int.test.ts:300-316`:** o caso novo prova três coisas. Fora da janela, cedo ou tarde, o `comecar` recusa com `PROVA_FORA_DA_JANELA`. Com a atividade encerrada, recusa com `ATIVIDADE_ENCERRADA`. Nas três recusas não nasce tentativa e não há sorteio (o roteiro fica intacto e não há ordem gravada). Pela régua da 70, não há nota nem decisão envolvida.
- **Minha recomendação da rodada 1 foi atendida.** Ela pedia levar o aviso da 4.0 para a 12.0, e a `12_task.md` agora tem a subtarefa 12.7 e dois casos na tabela, um de unidade web e um e2e em `aluno-prova.spec.ts`. Os casos exigem que o `PUT` leve `ordemDasAlternativas[posicao]`, que a questão seja achada por `numero`, e que o mapa das questões e o diagnóstico usem o índice original. O e2e ainda confere que o diagnóstico acerta depois do lote aprovado. Isso basta para a correção de objetiva e o diagnóstico formativo não partirem de uma resposta trocada pela tela.
- **`Atividade.tsx:193`:** o comentário falso saiu. Até a 12.0, a tela ainda manda a posição da tela (`fila.escolher(numero, indice)`), então uma prova embaralhada gravaria a alternativa errada. Isso continua sem bloquear aqui: a spec só pousa inteira, e a falha está registrada e tem teste previsto na 12.0.

Recomendações:
- O Validador deve conferir que a 12.0 entrega o e2e da prova embaralhada antes do pouso. Se a spec pousar sem ele, a correção de objetiva e o diagnóstico ficam errados sem ninguém ver, mesmo com o professor aprovando o lote: ele aprovaria em cima de uma resposta que o aluno não deu.

Arquivos relevantes:
- apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
- apps/api/src/atividade/embaralhamento.int.test.ts
- apps/web/src/areas/aluno/Atividade.tsx
- tasks/prd-avaliacao-e-correcao/12_task.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-26 16:01:41 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. Esta rodada não mexe em migration, esquema nem DTO de saída. O `conteudo` agora é lido uma vez só no `comecar` e passado adiante, sem nenhum campo a mais.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok. A ordem no `comecar` continua a mesma: primeiro `prova(id, true)` confere o alcance, depois a janela, depois o estado, e só então vem o sorteio. O caso novo em `apps/api/src/atividade/embaralhamento.int.test.ts:300` prova três recusas sem criar tentativa e sem sortear: prova cedo, prova tarde e atividade encerrada. O caso de alcance de outra turma, que dá `NAO_ENCONTRADO`, continua intacto.

Logs: limpos. O `minha-atividade.service.ts` não tem logger.

Auditoria: nada desta rodada pede auditoria. É o aluno lendo a própria prova.

Envio externo: nenhum. Não há IA neste caminho.

Seed/fixture: sintético. O teste novo usa a fixture de sempre (`ana`, a turma de teste e o roteiro `ZEROS`).

Bloqueantes: nenhum.

Recomendação da 1ª rodada foi feita. O docblock de `#ordemDeQuemComeca` (`apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:81-85`) agora diz que o `undefined` de `embaralhar(id)` não acontece e explica por quê: a aplicação está travada em `for share` na mesma transação. Diz também que, se um dia acontecesse, sairia como `InvariantException`, uma falha interna sem dado no corpo, e não como `NAO_ENCONTRADO`. Para a regra 20 isso basta: a guarda não revela a existência de nada ao aluno.

A outra recomendação foi levada adiante. O cuidado de não mostrar a ordem de um aluno a outro, usando `ordemDasAlternativas` só para mandar o índice original, entrou como subtarefa 12.7 em `tasks/prd-avaliacao-e-correcao/12_task.md`, com teste de unidade web e e2e previstos.

Recomendações:
- O comentário novo em `apps/web/src/areas/aluno/Atividade.tsx:193` diz "a tarefa 12.0 manda", mas hoje a tela ainda manda a posição. Vale escrever "até a 12.0, a tela manda a posição; a 12.0 passa a mandar `ordemDasAlternativas[indice]`", para ninguém achar que já está feito. É só texto, não vaza nada.

Pergunta de fechamento: a resposta é a mesma da 1ª rodada, porque o diff não muda o que se guarda nem para onde vai. A ordem sorteada fica em `tentativa_atividade.ordem`, presa ao aluno, e nada sai para fora.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-26 16:01:51 · `tasks/prd-avaliacao-e-correcao/4_task.md`

```
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
- O risco de um bundle velho recusar a `prova` com `ordemDasAlternativas` continua só como linha de arquivo previsto da 12.0 (`apps/web/src/api/atividades-do-aluno.ts`) e como nota para o runbook no pouso. Na validação, conferir que o pouso da spec só acontece depois da 12.0, ou que `docs/runbook.md` ganhou a linha do deploy.
```

Todas as correções que a 1ª rodada exigiu foram feitas. Conferi cada uma em `tasks/prd-avaliacao-e-correcao/12_task.md`:

- **Subtarefa 12.7:** a tela acha a questão por `numero` e manda `questao.ordemDasAlternativas[posicao]` como `alternativa` no `PUT`. O mapa e o diagnóstico passam a ser lidos pelo índice original.
- **Arquivos previstos:** `Atividade.tsx`, `Atividade.test.tsx` e `atividades-do-aluno.ts` estão na lista.
- **Teste de unidade web:** prova com sorteio conhecido e a certa numa posição de tela diferente da original. O que distingue é mandar a posição da tela.
- **e2e:** um caso em `e2e/aluno-prova.spec.ts` com uma aplicação embaralhada, conferindo o índice gravado e o diagnóstico depois do lote aprovado.
- **Comentário:** o de `apps/web/src/areas/aluno/Atividade.tsx:193` foi corrigido e aponta para a 12.0.

O resto do diff não muda o comportamento.

- **`minha-atividade.service.ts`:** o `conteudo` agora é lido uma vez só no `comecar`. A ordem alcance, janela, estado e sorteio continua a mesma, a trava `for share` também, e o retorno para quem já começou é igual.
- **`embaralhamento.int.test.ts`:** o caso novo prova que, fora da janela (cedo e tarde) e com a atividade encerrada, o `comecar` recusa sem criar tentativa e sem sortear. O roteiro do sorteador fica intacto.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-26 16:02:11 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` passou para o código atual com typecheck, lint, segredo, dependências, unidade e alvo.

Bloqueantes: nenhum

O que conferi nesta rodada:
- **A recomendação da 1ª rodada foi feita.** No `comecar`, o `conteudo` agora é lido uma vez só, logo depois da checagem de alcance (`minha-atividade.service.ts:226`). Essa leitura serve à contagem de questões do `#ordemDeQuemComeca` e ao `#emAndamento`. No `prova` (linha 199) a leitura também é uma só. Ler o `conteudo` antes de buscar a tentativa não muda o comportamento: um `conteudo` corrompido já derrubava a rota dentro do `#emAndamento`.
- **O caso novo (`embaralhamento.int.test.ts:300`) prova o que diz.** O `beforeEach` zera o roteiro, então o `toEqual(roteiroIntacto)` prova que nenhuma das três recusas sorteou. O caso testa a janela cedo, a janela tarde e a atividade encerrada, e em cada uma confere o código de erro, que nenhuma tentativa foi criada e que nenhuma ordem foi gravada.
- **O bloco de mutação novo existe.** O `conteudo.questoes.length - 1`, contra "sorteio fixo, dois alunos", cobre o argumento que entrou. Os três blocos já existentes foram reescritos para a linha nova de `sortearOrdem`.

Recomendações:
- `tasks/prd-avaliacao-e-correcao/12_task.md`, subtarefa 12.7, quarto item: pede para trocar o comentário de `Atividade.tsx` ("O índice é a identidade da alternativa no contrato: a ordem delas não muda"), mas esta rodada já trocou esse comentário (`apps/web/src/areas/aluno/Atividade.tsx:193`). O item, e a menção ao comentário do `label` na linha da tabela de arquivos previstos, ficaram desatualizados. Basta reescrever o item como "manter o comentário verdadeiro depois do `ordemDasAlternativas[posicao]`" ou tirá-lo.
- O comentário novo de `Atividade.tsx:193` descreve o que a 12.0 vai fazer, e o código de hoje continua mandando a posição da tela. Isso fica aceitável só porque a spec não chega à `develop` antes da 12.0, o que já está em "Fora do escopo" da 4.0. Vale o Validador conferir isso no pouso.

## test-engineer · 2ª rodada · APROVADO · 2026-11-26 16:02:22 · `tasks/prd-avaliacao-e-correcao/4_task.md`

VEREDITO: APROVADO

**Cenários exigidos (o que mudou nesta rodada):**
- Ao começar a prova, o sorteio só acontece depois de conferidos a janela e o estado da atividade. Cedo, tarde ou com a atividade encerrada, a recusa sai sem criar tentativa e sem sortear.
- A troca no `minha-atividade.service.ts` não muda o comportamento: o `conteudo` agora é lido uma vez e o total de questões vai direto ao sorteio. A mutação nova desse total precisa ficar vermelha pelo motivo certo.
- Pela minha recomendação da 1ª rodada, a tarefa 12.0 tem de registrar um cenário que fique vermelho se a tela mandar a posição da tela.

**Cobertos:**
- **Começar fora da janela e com a atividade encerrada:** o caso novo é "o sorteio vem depois da janela e do estado" (`embaralhamento.int.test.ts:300`).
  - Abre duas provas fora da janela, uma cedo (`[30, 90]`) e outra tarde (`[-90, -30]`). Exige `409 PROVA_FORA_DA_JANELA` e zero tentativas.
  - Encerra uma terceira e exige `409 ATIVIDADE_ENCERRADA` e zero tentativas.
  - No fim confere que o roteiro à espera ficou inteiro (`toEqual(roteiroIntacto)`) e que não há ordem gravada.
  - Se o sorteio subisse para antes da guarda da janela ou do estado, o sorteador consumiria os 19 números do roteiro (o `beforeEach` o zera na linha 116), e o caso ficaria vermelho pelo motivo certo.
  - O caso está citado pelo nome na tabela da `4_task.md`.
- **Mutação `conteudo.questoes.length - 1`:** com 4 questões em vez de 5, o sorteio consome 15 números e não 19. O `comecarCom` do caso "sorteio fixo, dois alunos" exige o roteiro todo consumido (linha 76), então fica vermelho pelo motivo certo. Os três blocos que já existiam acompanham a nova assinatura (`totalDeQuestoes`), e a contagem diz 42 blocos.
- **O `conteudo` lido antes da tentativa:** a leitura vem depois do alcance (`prova(id, true)` e `NAO_ENCONTRADO`). Uma linha sem condição não precisa de bloco. Um `conteudo` corrompido continua saindo como falha interna, como antes, só que mais cedo. O comportamento não mudou.
- **Tarefa 12.0:** a subtarefa 12.7 e duas linhas da tabela de testes estão lá.
  - Um teste de unidade na web em que mandar a posição da tela fica vermelho.
  - Um e2e em que a resposta gravada é o índice original do gabarito, e não a posição.
  - A correção do comentário de `Atividade.tsx` também entrou.
- **Resto do arquivo:** nenhum `.skip`, `.only` ou mock que esconda a regra. O sorteador injetado com roteiro é o próprio instrumento da prova.
- `npx vitest run apps/api/src/atividade/embaralhamento.int.test.ts` passou: 10 de 10.

**Bloqueantes:** nenhum.

**Recomendações:**
- A ordem "janela e estado antes do sorteio" está provada pelo caso novo, mas não tem bloco em "Mutações". Isso não bloqueia, porque nenhuma linha nova de produção tem condição. Se o formato dos blocos aceitar troca de linhas, um bloco que suba o `#ordemDeQuemComeca` para antes da guarda da janela deixaria a prova registrada.

Arquivos:
- `apps/api/src/atividade/embaralhamento.int.test.ts`
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts`
- `tasks/prd-avaliacao-e-correcao/4_task.md`
- `tasks/prd-avaliacao-e-correcao/12_task.md`
