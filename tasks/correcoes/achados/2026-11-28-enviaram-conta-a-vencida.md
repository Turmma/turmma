# Achados das revisões — `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 13:11:19 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo e nenhuma migration. A correção só lê o que já existe em `tentativa_atividade` (aluno, começo, limite base e envio), mais `extensao_de_tempo`, `indisponibilidade` e `pulso_da_api`. O aluno é usado só em memória, para escolher a extensão que vale para ele, e não chega à saída.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- Os ids que entram em `#contandoAsVencidas` vêm só de `#lidas`, que aplica `#noAlcance`: escola, ano em curso e vínculo confirmado da professora na turma e na disciplina do artefato.
- A consulta nova repete o filtro de escola e de ano pelo contexto (`atividade-aplicada.repository.ts:172-173`). A junção usa a chave composta.
- A subconsulta das extensões fica presa à escola e à aplicação da linha de fora. O defeito de colunas sem o nome da tabela, que misturava as extensões de outras provas, está descrito e o caso da "prova vizinha" o prova.
- Se eu trocar o id na URL, o id de outra turma, disciplina ou escola não passa de `#lidas`. A resposta segue como a do inexistente, e o caso de isolamento de antes continua valendo.
- A saída (`AplicacaoLida`) continua sendo só contagem. O `enviaram` muda de valor, mas não de forma, e não expõe aluno, limite nem situação de ninguém.

Logs: limpos. Não há logger nem console nos dois repositories.

Auditoria: não se aplica. É uma leitura de agregado pela professora da turma; não há leitura de dado de aluno por coordenação ou rede, nem exportação, alteração de nota ou de permissão.

Envio externo: nenhum. Não há IA nesta correção.

Seed/fixture: sintético ("Aluna Sintética Ana", "Aluna Sintética Bia", "Aluno Sintético Caio", "Aluno Sintético Colega", em `extensao.int.test.ts:135`).

Bloqueantes: nenhum.

Recomendações:
- `atividade-aplicada.repository.ts:174`: com a lista ou o `porId` só de aplicações encerradas, `abertas` fica vazio e vai para `inArray(..., [])`. O drizzle 0.45.2 transforma isso em `false`, e o encerrar do teste passa por esse caminho. Ainda assim, um `if (abertas.length === 0) return lidas` evitaria uma ida ao banco sem motivo e não deixaria a correção depender desse comportamento do drizzle. Não é questão de privacidade.
- Pergunta de fechamento: a correção não muda o que o sistema guarda nem para onde envia. Ela só passa a contar, numa leitura agregada, um fato que a rotina já grava. O arquivo do titular segue como estava.

Arquivos auditados:
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
- apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
- apps/api/src/atividade/extensao.int.test.ts
- tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 13:11:19 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff só mexe na leitura da contagem `participacao.enviaram` (`#contandoAsVencidas`, chamada por `porId` e `list`). O que grava `enviada_em` na vencida e corrige continua sendo o `encerrarProva` que já existia, e ele só roda quando a professora encerra ou quando a rotina age depois do `fecha_em`. Nada disso mudou. Todos com autor humano? sim, porque nenhum caminho novo foi criado.

Decisão autônoma sobre aluno: ausente. A vencida passa a entrar na contagem só na leitura. Nada é gravado e nada encerra, corrige ou encaminha sozinho por causa do número. Conferi os usos de `porId` em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts` (aplicar, mudar a janela, encerrar) e em `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts`. Em todos, o valor só serve de resposta. Encerrar continua sendo decisão da professora, e agora com o número certo. A Bia, que ainda tinha tempo, não vira "enviada" depois do encerramento, e o teste prova isso.

Aprovação registrada: ok, nesta tarefa não há saída de IA. A contagem é uma conta feita com `limiteDaTentativa`, sem modelo.

Supervisão do tutor: ok, a tarefa não toca o tutor.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente novo e nenhum nível alterado.

Supervisão não é vigilância (item 7): ok. A professora recebe só o total somado (`iniciaram` e `enviaram`), sem aluno e sem saída da aba. Nenhuma inferência foi criada. A consulta nova lê começo, limite, extensões, quedas e pulso, que são dados da prova e não do comportamento do aluno.

Discursiva e redação (D55) e medir o professor (D45): não se aplicam. Não há nota, conceito nem indicador de professor no diff.

`docs/regulacao.md`: não precisa mudar.

Bloqueantes: nenhum.

Recomendações:
- A frase de `oQueFazer` ("Os alunos estão respondendo") pode continuar aparecendo quando ninguém mais tem tempo. A tarefa já registra isso como texto de tela, fora desta correção. Fica para a validação garantir que a próxima tarefa de tela faça a frase concordar com o acompanhamento. Que ela não induza a professora a esperar sem motivo é sobretudo questão de clareza, e não fere a regra 70.
- Hoje os trechos de SQL compartilhados (`extensoesDaAplicacao`, `indisponibilidadesDesde`, `ultimoPulsoDaApi`) moram em `acompanhamento.repository.ts`, e `atividade-aplicada.repository.ts` passou a importar dali. Isso não bloqueia, mas fica mais claro movê-los para um módulo próprio do limite da tentativa (observação de organização para o `revisor-geral`).

## revisor-geral · 1ª rodada · APROVADO · 2026-11-28 13:11:20 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO

Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido

Bloqueantes: nenhum.

A correção faz o que o achado maior 1 da `validacao.md` pediu, e nada além. Agora a leitura da professora conta como enviada a tentativa vencida que ainda não tem `enviada_em`, como a Tech Spec §5.5 manda ("vencida sem envio conta como enviada em toda leitura", RF5). O limite sai da mesma `limiteDaTentativa` que o acompanhamento usa, então não existe um segundo jeito de calculá-lo. A prova encerrada fica com a conta que o encerramento gravou, também como a §5.5 diz. Nada mudou em contrato nem em tela. A Tech Spec já descrevia esse comportamento, então não há divergência a registrar.

Os quatro caminhos do service (aplicar, mudar a janela, encerrar e segunda chamada) e a lista leem pelo `porId` e pelo `list`, e esses dois passam pela contagem nova. O teste cobre a vencida, a que ainda tem tempo, a estendida, a sem limite e a que enviou e depois venceu (conta uma vez só). Cobre também a vencida de outra prova, a extensão da prova vizinha, que não pode alterar o limite das outras, e a prova encerrada, que não é recontada.

Recomendações:
- `atividade-aplicada.repository.ts:153`: quando nenhuma das aplicações lidas está aberta, a consulta de `#contandoAsVencidas` roda mesmo assim, com `inArray` vazio. O drizzle 0.45 escreve isso como `false`, então o número sai certo, mas é uma ida ao banco à toa no encerrar e na lista só de provas encerradas. Um `if (abertas.length === 0) return lidas` resolve.
- `atividade-aplicada.repository.ts:187`: a linha junta a condição e o incremento do mapa em uma só. Separar a condição numa variável (`venceu`) deixa a regra mais fácil de ler.
- `atividade-aplicada.repository.ts:6`: as subconsultas compartilhadas (`extensoesDaAplicacao`, `indisponibilidadesDesde`, `ultimoPulsoDaApi`) agora moram em `acompanhamento.repository.ts`, que passa a ser importado por outro repository. Um arquivo próprio para os trechos do limite deixaria a dependência mais clara. É só organização.
- `atividade-aplicada.repository.ts:166-167`: o comentário sobre a junção explica uma armadilha real do drizzle e vale manter. Só está longo para um comentário de linha.

Arquivos revisados:
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`
- `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`
- `apps/api/src/atividade/extensao.int.test.ts`
- `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-28 13:11:21 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela ou migration nova. As leituras novas usam `tentativa_atividade` e `atividade_aplicada` (as duas com `escola_id` e `ano_letivo_id`), `extensao_de_tempo` (filtrada pela escola e pela aplicação da linha de fora), `indisponibilidade` e `pulso_da_api` (globais, sem dono, como já eram).

Queries verificadas:
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`, `#contandoAsVencidas`: a escola e o ano vêm de `requireEscolaId()` e `requireAnoEmCurso()`, ou seja, do contexto autenticado. Os ids vêm de `#lidas`, que já filtra por escola, ano e vínculo da professora. A junção com `atividade_aplicada` usa a chave composta.
- `inArray` com lista vazia: o drizzle 0.45.2 escreve `false`, então não há erro nem leitura sem filtro.
- `porId` e `list` continuam passando por `#noAlcance` antes da soma. Nenhum parâmetro do cliente entra no escopo: o `turmaId` da query string só filtra dentro do alcance, como antes.
- `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`: os três trechos de SQL só foram movidos para fora (`extensoesDaAplicacao`, `indisponibilidadesDesde`, `ultimoPulsoDaApi`). A consulta do acompanhamento ficou igual.
- A saída só muda um número (`participacao.enviaram`). Nenhum id de aluno sai, nenhuma rota nova foi criada, as respostas de erro não mudaram e o 404 para o que está fora do alcance continua.

Teste de isolamento: presente e efetivo.
- Os casos de isolamento de `porId` e `list` continuam no bloco `isolamento` de `apps/api/src/atividade/extensao.int.test.ts`, que já existia.
- O caso novo prova que uma prova não contamina a outra. Se a condição `eq(atividadeAplicada.id, tentativaAtividade.atividadeAplicadaId)` for tirada da junção, a extensão de 120 min da prova vizinha passa a valer para todas, e o `enviaram: 2` cai.
- Se o escopo de escola e ano da consulta nova for tirado, nenhum teste quebra: os ids já chegam filtrados de `#lidas` e a função é privada. Não há vazamento possível por esse caminho, e o motivo está escrito no arquivo da tarefa. Fica como defesa em profundidade, conforme a regra 10, item 3.

Bloqueantes: nenhum

Recomendações:
- Faltam duas linhas de comentário. Em `extensoesDaAplicacao` (`apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`), uma dizendo que os argumentos precisam ser colunas de uma tabela juntada, para o drizzle escrever o nome dela. Em `#contandoAsVencidas`, uma dizendo que a função só pode receber linhas que já vieram de `#lidas`. Sem isso, quem reusar o trecho numa consulta de uma tabela só repete o defeito que a primeira versão teve.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 13:11:38 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO
Caminho quente tocado: prova (a leitura que a professora faz da aplicação: listar, aplicar, mudar a janela, encerrar e segunda chamada; nenhum caminho do aluno)
Rate limit: ok (nenhuma rota nova; o limite das rotas que já existem não mudou)
Fila e prioridade: ok (não se aplica: nenhum job novo; o cálculo é só leitura, limitado a uma página de uma turma)
Concorrência: protegida (é só leitura; no encerrar, o `porId` roda depois da gravação, e a aplicação encerrada não é recontada)
Índice e paginação: ok. A consulta nova em `tentativa_atividade` filtra por `escola_id`, `ano_letivo_id` e `atividade_aplicada_id in (...)`, e o índice único `tentativa_atividade_uma_por_aluno` começa por essas colunas. As subconsultas usam `extensao_de_tempo_chave_por_aplicacao` (escola, aplicação), `indisponibilidade_fim_idx` e o pulso de uma linha só. O total fica preso à página do `list` (`limite + 1`) e às tentativas sem envio das aplicações abertas. A lista não é relida em intervalo pela tela (só o acompanhamento é), então não há leitura repetida por turma às 10h.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhuma rota nem job novo; a latência entra na medida da rota que já existe)
Bloqueantes: nenhum
Recomendações:
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts` (`#contandoAsVencidas`): se `abertas` estiver vazio, sair antes da consulta e devolver `lidas`. Hoje toda leitura de aplicação já encerrada, inclusive a resposta do encerrar, faz uma ida ao banco com `inArray(..., [])` que não devolve nada.
- Quando o cenário de carga da prova online for revisto, incluir a lista da professora com a prova aberta e quarenta tentativas em andamento. Só assim o custo das subconsultas por tentativa aparece medido, e não estimado.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-28 13:12:37 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** a tentativa vencida, com a janela aberta, conta em `enviaram` na lista da professora.
- **Bordas:**
  - a tentativa que ainda tem tempo;
  - a estendida por aluno;
  - a sem limite;
  - a que já enviou e cujo limite passou depois, contada uma vez só;
  - a extensão da turma em outra prova, que não pode andar o limite desta;
  - a vencida de outra prova, que não passa para esta;
  - a prova encerrada, que não é recontada quando o limite de quem não enviou passa depois;
  - a queda fechada da API dentro da tentativa, que anda o limite;
  - a lacuna aberta do pulso.
- **Permissão e isolamento:** os ids vêm de `#lidas`, com `#noAlcance`, que não mudou. Os casos de isolamento de `porId` e `list` já existem em `atividade-isolamento.int.test.ts`.
- **Concorrência:** não se aplica. É só leitura, e nada é gravado.

**Cobertos:** todos, menos a queda fechada. Todos estão no caso `extensao.int.test.ts` › "a tentativa vencida, com a janela ainda aberta, conta como enviada…". Rodei o caso isolado e ele passa (1 passed). Cada afirmação da seção "Teste que reproduz" tem a sua asserção:
- Ana (vencida) e Caio (enviou) dão `enviaram: 2`; Bia, o colega estendido e o aluno sem limite ficam fora.
- `outra` dá 1 e `vizinha` dá 0.
- O encerrar dá 2, e a leitura depois do `update` da Bia continua 2.

Os blocos de mutação chegam às cláusulas pelo motivo certo:
- `filter(() => true)` só fica vermelho na última asserção, a da Bia depois do encerramento.
- O bloco da junção sem `eq(atividadeAplicada.id, …)` fica vermelho pela prova `vizinha`, de 120 min.
- O bloco de `ultimoPulsoDaApi` fica vermelho porque a lacuna de 1 h anda o limite da Ana. Isso prova que o pulso chega a `limiteDaTentativa` no caminho novo.

**Bloqueantes:**
1. **`apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:184` não tem teste nem motivo.** A linha é `indisponibilidades: tentativa.indisponibilidades.map((queda) => ({ inicio: new Date(queda.inicio), fim: new Date(queda.fim) }))`, junto com a coluna `indisponibilidades: indisponibilidadesDesde(tentativaAtividade.iniciadaEm)` do select (linha 163).
   - **O que está errado:** o caso novo não grava nenhuma `indisponibilidade`. Trocar a linha por `indisponibilidades: []` deixa tudo verde. Ela não tem bloco de mutação e também não está entre as "Sem bloco, com o motivo".
   - **Por que importa:** a própria seção "Causa" do documento diz que a conta não se faz em SQL por causa das extensões, das quedas fechadas e da lacuna do pulso. A extensão e o pulso têm bloco; a queda não. Sem a queda, um aluno com o limite base vencido e uma queda de 5 min dentro da prova aparece como "enviou" na lista. No acompanhamento, o mesmo aluno aparece "fazendo". É a mesma divergência que esta correção existe para fechar, e o teste do acompanhamento (linhas 338 a 363) não alcança este caminho.
   - **Correção exigida:** no caso novo, ou num caso irmão, criar uma tentativa com `baseEmMin: -2` (ou parecido) e uma `indisponibilidade` fechada de 5 min dentro dela, como na linha 339, e verificar que ela não entra em `enviaram`. Depois, apagar a linha da queda, como a linha 363 já faz. Declarar o bloco `-indisponibilidades: tentativa.indisponibilidades.map(...)` / `+indisponibilidades: [],`, com esse caso como teste.

**Recomendações:**
- **`atividade-aplicada.repository.ts:194`, o `porId` passando por `#contandoAsVencidas`:**
  - Nenhum chamador atual lê por `porId` uma aplicação aberta que tenha tentativa. O aplicar e a segunda chamada leem uma aplicação recém-criada. O mudar a janela só roda antes do primeiro começo (`PROVA_JA_COMECOU`). O encerrar lê depois de encerrar.
  - A mutação que tira o embrulho é, portanto, equivalente: nenhum teste a pegaria, e a asserção do encerrar (`enviaram: 2`) também não a prova, porque nessa hora a vencida já tem `enviada_em`.
  - O documento diz que o caso "cobre… a resposta do encerrar". Vale escrever entre as linhas sem bloco que o efeito observável está só no `list`, e que o `porId` fica por consistência.
- **Ida a mais ao banco no `porId`:** com `abertas` vazio, `#contandoAsVencidas` ainda vai ao banco com `inArray(…, [])`. Isso acontece no aplicar, na segunda chamada e no encerrar. Um retorno antecipado quando `abertas.length === 0` poupa essa ida. É assunto do `infra-guardian` e não muda a regra.
- **A fronteira `<=`:** a igualdade (`limite === agora`) não tem caso. A Tech Spec §5.5 diz `limite <= now()`. Provar essa fronteira exigiria fixar o `now()` do banco. Fica registrado, sem bloquear.

Arquivos auditados:
- tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
- apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
- apps/api/src/atividade/extensao.int.test.ts

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-28 13:28:01 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nem migration nova. Nesta rodada as consultas tocam:
- `tentativa_atividade`, `atividade_aplicada` e `extensao_de_tempo`, que têm `escolaId` e, onde o dado varia por período, `anoLetivoId`;
- `indisponibilidade` e `pulso_da_api`, que são globais, sem dono, e já estavam assim antes desta tarefa.

Queries verificadas:
- `AtividadeAplicadaRepository.#contandoAsVencidas` (`apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`). Quando nenhuma aplicação está aberta, o método devolve as linhas sem ir ao banco. Essas linhas vêm de `#lidas`, que já aplica escola, ano e vínculo. Um id de outra escola não volta de `#lidas`, então não chega a esta consulta e `porId` devolve `undefined`. A segunda consulta pega escola e ano do contexto (`requireEscolaId()`, `requireAnoEmCurso()`) e se limita aos ids das linhas lidas. Nenhum parâmetro vem do cliente.
- `porId` e `list` agora passam por `#contandoAsVencidas`, sem mudança no escopo.
- `extensoesDaAplicacao` (`apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`). Nas duas chamadas ela roda numa consulta com junção, então o drizzle escreve as colunas com o nome da tabela e a subconsulta fica presa à escola e à aplicação da linha de fora. O comentário novo descreve isso corretamente.
- Nenhum `@Unscoped()`. Nenhum endpoint novo nem `escolaId` vindo do corpo ou da query string.

Teste de isolamento: presente e efetivo. O caso que já existia continua lá: a vencida de `outra` não passa para `id`, e a extensão da turma inteira na prova `vizinha` não anda limite de ninguém das outras duas. Se a junção sair ou a subconsulta perder a amarração à aplicação, ele quebra. Os casos novos reforçam a prova:
- a leitura por `porId` passa a ser conferida, com o contexto da professora;
- o caso da queda fechada prova que as quedas entram no limite;
- o caso da contagem de consultas dá 1 para a encerrada e 2 para a aberta, e falha se o retorno antecipado sair.

Bloqueantes: nenhum.

Recomendações:
- O caso da queda grava em `indisponibilidade`, que é global, e só apaga no `finally`. Se outro arquivo de teste rodar em paralelo no mesmo banco, ele pode ler essa queda enquanto ela existe. Isso não é questão de isolamento entre escolas, mas pode deixar o resultado instável. Rodar esse caso em série ou limitar a queda à janela da prova resolve.
- O texto da armadilha da junção aparece em dois lugares: no JSDoc de `extensoesDaAplicacao` e no comentário da junção em `#contandoAsVencidas`. O encurtamento já está registrado nas recomendações sem aplicar do documento da correção; manter o texto completo num lugar só.

## test-engineer · 2ª rodada · APROVADO · 2026-11-28 13:28:02 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO

**Cenários exigidos (os mesmos da 1ª rodada):**
1. Caminho feliz: a tentativa vencida com a janela aberta conta como enviada, pela lista e pelo `porId`.
2. Casos de borda:
   - a tentativa que ainda tem tempo;
   - o aluno com tempo a mais;
   - a tentativa sem limite;
   - quem enviou e cujo limite passou depois conta uma vez só;
   - a vencida de outra prova não passa para esta;
   - a extensão de uma terceira prova, para a turma toda, não anda o limite das outras;
   - a queda fechada da API dentro da prova anda o limite;
   - a prova encerrada não é recontada quando o limite de quem não enviou passa depois.
3. Permissão e isolamento: os ids saem de `#lidas`, que aplica a escola, o ano e o vínculo da professora. O escopo repetido na consulta das tentativas fica sem bloco, com o motivo escrito, e a conferência é do `tenancy-guardian`.
4. Carga (regra 80): a aplicação encerrada não faz a segunda ida ao banco.

**Cobertos:**
- **Correção exigida 1, feita.** O caso `a queda fechada da API dentro da prova anda o limite…` (`apps/api/src/atividade/extensao.int.test.ts:605-615`) cria a tentativa com `baseEmMin: -2` e uma queda fechada de 6 min dentro dela.
  - Com a queda, o limite fica 4 min à frente e a resposta é `enviaram: 0`. Trocar a linha por `indisponibilidades: []` devolve `enviaram: 1` na primeira asserção, então o teste fica vermelho pelo motivo certo.
  - A queda é apagada num `finally`, como o caso da linha 364 já fazia.
  - O bloco foi declarado com esse caso como teste.
- **Recomendações que a Mesa mandou aplicar:**
  - A saída antecipada `if (abertas.length === 0) return lidas` tem bloco. O caso `a aplicação encerrada não custa a segunda ida ao banco…` (`extensao.int.test.ts:617-630`) conta as consultas no pool: 1 para a encerrada e 2 para a aberta. Tirar a saída faz a encerrada contar 2.
  - A condição `venceu` foi separada, e os três blocos foram reescritos sobre ela.
  - O comentário da junção foi acrescentado ao método e ao JSDoc de `extensoesDaAplicacao`.
  - O `porId` ganhou asserção própria (`extensao.int.test.ts:589-591`, esperado `enviaram: 2`) e um bloco que o devolve à versão sem a soma. Com essa versão, o `porId` leria `enviaram: 1` e o teste ficaria vermelho.
- **Rodei agora:**
  - `npx vitest run apps/api/src/atividade/extensao.int.test.ts`: 23 de 23 verdes.
  - `mutacoes.ts --faltando`: nenhuma linha nova de produção com condição fica sem bloco. Bate com as "17 linhas (13 blocos, 3 motivos)" do documento.
- **O resto:** não há `.skip`, teste comentado nem mock de coisa nossa (o banco é real e o contador só embrulha o `query` do pool). Não há IA envolvida.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A tabela "Recomendações sem aplicar" de `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md` dá `TODO.md` como destino de quatro itens, mas o `TODO.md` não está na lista de alterados. Ou se registra lá nesta correção, ou o texto passa a dizer que o registro fica para o fechamento da spec. Senão a validação não acha os itens.
2. `indisponibilidade` é uma tabela global, e `extensao.int.test.ts:605-615` depende de nenhuma outra queda cobrir o mesmo intervalo. Se outro arquivo de teste gravar uma queda ao mesmo tempo, a asserção final `enviaram: 1` pode falhar. O caso da linha 340 já tinha esse mesmo risco e a esteira começa com o banco vazio, por isso fica só registrado.
3. O vermelho do bloco que tira `if (abertas.length === 0) return lidas` vem de rodar `inArray(..., [])` com lista vazia. Hoje isso faz uma consulta a mais e o teste conta 2. Se uma versão futura do drizzle passar a lançar erro com lista vazia, o caso continua vermelho, mas por outro motivo. Vale um comentário no caso dizendo que a contagem é a prova.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-28 13:28:13 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A leitura nova traz da tentativa só `alunoId`, `iniciadaEm`, `limiteBaseEm` e `enviadaEm`. Ela usa o `alunoId` dentro do repository para escolher a extensão de cada aluno no `limiteDaTentativa`, e ele não chega à resposta. A extensão de tempo, que é adaptação e portanto dado sensível pelo item 3, também é usada só no cálculo. O DTO `AplicacaoLida` continua só com contagens (`iniciaram`, `enviaram`).

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo, coluna nem migration nova.

Autorização por objeto: ok.
- `#contandoAsVencidas` só recebe linhas que já passaram por `#lidas`, que aplica escola, ano em curso e vínculo confirmado na turma e na disciplina. A consulta extra repete `escolaId` e `anoLetivoId` do contexto e se limita aos ids lidos (`atividade-aplicada.repository.ts:177-182`).
- Trocar o id no `porId` não abre nada: id de outra escola ou de outra turma não sai de `#lidas`, então não há o que somar, e a resposta continua igual à do id inexistente.
- A volta antecipada com `abertas` vazio (`:157`) só tira uma ida ao banco. Não muda o alcance.

Logs: limpos. O diff não acrescenta nenhuma chamada de log. O `contarConsultas` do teste (`extensao.int.test.ts:23-38`) só conta as chamadas a `query` e não guarda o texto nem os parâmetros.

Auditoria: não se aplica. A leitura é da professora da própria turma, com contagem agregada sem aluno. Não há leitura por coordenação ou rede, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum. Não há IA nem provedor nesta correção.

Seed/fixture: sintético. Ana, Bia, Caio e o colega são alunos criados pela bancada de teste (`montarEscolaComAssistente`). A queda inserida em `indisponibilidade`, tabela global sem dono, é apagada no `finally`.

Pergunta de fechamento: a correção não cria dado guardado sobre o aluno nem destino novo. Ela só muda uma contagem calculada na leitura. O que já respondia ao arquivo do titular continua respondendo.

Correções da rodada anterior: nenhuma foi exigida. A recomendação de sair antes da consulta quando não há aberta foi aplicada em `atividade-aplicada.repository.ts:157`, e o teste "a aplicação encerrada não custa a segunda ida ao banco" e uma mutação declarada no documento garantem que ela continua lá.

Bloqueantes: nenhum.

Recomendações:
- O comentário em `acompanhamento.repository.ts:46` registra uma armadilha do drizzle: numa consulta de uma tabela só, a coluna sai sem o nome da tabela e entram as extensões de todas as provas da escola. Hoje isso é protegido pela junção e pela "terceira prova" do teste ("a extensão de uma terceira prova... não anda o limite de ninguém"). Mesmo assim vale qualificar a coluna de fora explicitamente dentro de `extensoesDaAplicacao`, com alias ou `sql.raw` do nome da tabela, para que um chamador futuro com uma tabela só não misture extensões entre provas da mesma escola. Ela já está registrada no documento da tarefa, na seção "Recomendações sem aplicar", e pode ir para o `TODO.md`.

Arquivos auditados:
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
- apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
- apps/api/src/atividade/extensao.int.test.ts

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-28 13:28:17 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado. O diff aplica as três recomendações que a Mesa mandou aplicar, mais os testes do `porId`, da queda fechada e da aplicação encerrada. Nada passa para tarefa futura.

**Aderência à Tech Spec:** ok. A §5.5 e o RF5 ("vencida sem envio conta como enviada em toda leitura") valem também no `porId`. A encerrada fica com o que o encerramento gravou, e o limite sai da mesma `limiteDaTentativa` do acompanhamento.

**Portão local:** carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

**Bloqueantes:**
- `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md:174-178`: a seção "Recomendações sem aplicar" manda quatro linhas para o `TODO.md`, e o `TODO.md` não foi alterado na árvore (`git status` limpo, nenhuma das entradas existe lá). As quatro são:
  - mover `extensoesDaAplicacao`, `indisponibilidadesDesde` e `ultimoPulsoDaApi` para um arquivo próprio;
  - o caso da fronteira `limite === agora`;
  - a frase `oQueFazer` quando ninguém mais tem tempo;
  - a lista da professora no cenário de carga da prova online.

  O `executar-task/SKILL.md:313` põe essa conferência antes de pedir rodada, porque sem ela a recomendação se perde. A 12.0 da F4 reprovou pelo mesmo motivo.

  Correção exigida: abrir no `TODO.md` a seção "Da correção 2026-11-28-enviaram-conta-a-vencida, fora dela", no padrão das seções vizinhas (por volta da linha 4590 em diante). Nela entram as quatro linhas, cada uma com o revisor, a rodada e o destino da tabela, no mesmo commit. A linha "encurtar o comentário da junção" foi recusada sem ação e não vai para lá.

**Recomendações:**
- `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts:46` repete quase palavra por palavra o comentário de `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:170-171` sobre o drizzle qualificar a coluna. Basta um dos dois: o da função exportada, que vale para quem chamar.
- No caso da queda fechada (`apps/api/src/atividade/extensao.int.test.ts`), a margem é de 4 min: o limite base passou há 2 min, e a queda de 6 min o leva para daqui a 4. Sob CI lenta segue folgada, mas um comentário dizendo de onde vem essa folga ajuda quem mexer nos números.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-28 13:28:18 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff só lê. `#contandoAsVencidas` faz um `select` em `tentativa_atividade` com junção em `atividade_aplicada`, e o teste só lê e chama o encerrar que já existia. Nenhum dos três arquivos grava em `Nota` nem toca `lancadaPor`, `Correcao` ou entrega. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente. A soma ao `enviaram` só aparece na leitura, como contagem da aplicação sem nome de aluno (`AplicacaoLida`). Não muda o estado de nenhuma tentativa, e o fato continua gravado pela rotina e pelo encerramento, como na Tech Spec §5.5. Ela não decide aprovação, reprovação nem encaminhamento.

Aprovação registrada: ok. O diff não traz saída de IA. Ele trata da contagem de participação e do limite de tempo, que é calculado por regra fixa (`limiteDaTentativa`), sem modelo.

Supervisão do tutor: ok. O diff não toca o tutor.

Autonomia declarada e visível: sim. O diff não mexe em agente nem em governança.

Outros itens da regra 70:
- **Item 7 (supervisão não é vigilância):** a leitura nova traz só aluno, começo, limite, extensões, quedas da API e pulso, para saber se o tempo acabou. Não há saída da aba (D70), tempo ocioso, navegação nem inferência sobre o aluno. O que a professora recebe é um número agregado por aplicação.
- **Item 2a (D55):** nenhum campo novo guarda nota, conceito ou devolutiva.
- **Itens 8 e 9 (medir o professor):** o diff não toca indicador de professor.

Correções exigidas na rodada anterior: nenhuma, então não havia o que conferir.

Bloqueantes: nenhum.

Recomendações (nenhuma é bloqueante e nenhuma é nova; ficam registradas para a validação):
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:174`: a fronteira `limite <= agora` conta como vencida a tentativa cujo limite cai exatamente no instante da leitura. Isso precisa bater com a regra da rotina, para a professora não ver "enviou" antes de o aluno perder a vez. O item já está na seção "Recomendações sem aplicar" da tarefa e tem destino.
- A dependência entre os dois repositórios (`atividade-aplicada.repository.ts` importa as subconsultas de `acompanhamento.repository.ts`) continua só como recomendação de mover os trechos de SQL para um arquivo próprio, também com destino.

Arquivos auditados:
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`
- `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts`
- `apps/api/src/atividade/extensao.int.test.ts`
- `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-28 13:28:50 · `tasks/correcoes/2026-11-28-enviaram-conta-a-vencida.md`

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
- O cenário de carga com a lista da professora segue só no TODO.md. Ele precisa entrar no teste de carga antes do piloto, porque uma aplicação aberta agora custa duas consultas por leitura (o teste prova as duas).
```

Nesta rodada conferi:

- **A recomendação da rodada 1 foi aplicada.** Sem aplicação aberta, a função devolve antes de consultar: `if (abertas.length === 0) return lidas` em `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:157`. Um teste conta as idas ao banco do `porId`, uma para a aplicação encerrada e duas para a aberta.
- **O resto do diff não altera o que já estava aprovado.** São comentários, a troca de uma linha por `const venceu` sem mudar o comportamento, e testes novos: o do `porId`, o da queda fechada (inclui `indisponibilidade` no banco e apaga no `finally`, como outros testes do repositório já fazem) e o da contagem de consultas.
- **O escopo continua igual.** A consulta das vencidas mantém o filtro por escola e ano, e os ids continuam vindo das linhas de `#lidas`.
- **Os testes passam.** Rodei `apps/api/src/atividade/extensao.int.test.ts` e os 23 casos passaram. Nenhum chama provedor pago.
