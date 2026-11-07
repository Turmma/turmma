# Achados das revisões — `tasks/prd-semana-do-professor/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 20:42:44 · `tasks/prd-semana-do-professor/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: a tarefa não cria tabela nem migration. Ela só lê `atividade_aplicada`, `artefato`, `entrega` e `vinculo`, e todas têm `escola_id` e `ano_letivo_id`. Os joins repetem escola e ano: `artefato` por (escola, ano, id) e `atividade_aplicada` por (escola, ano, turma, id).

Queries verificadas: as três consultas de `consultasDosItens` e `itensDaSemana`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts`.
- A escola vem de `requireEscolaId()`. A professora vem de `requestSessao().usuarioId`, dentro de `#daProfessora`.
- O `exists` exige um vínculo `professor` e `confirmado` na turma da linha e na disciplina do artefato.
- O `anoLetivoId` que o repository recebe vem de `anoEmCurso()`, que lê o contexto e confere a escola do contexto. Nenhum dado do cliente decide o escopo: a query string só traz `segunda`.
- `sql.raw` só recebe a constante `FUSO_DO_USO`, que não vem de entrada.
- Não há `@Unscoped()`.
- Não há caminho da camada de rede para essa leitura.
- Não há erro novo, porque a rota responde lista vazia.

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana-itens.int.test.ts`, no caso R2.
- Sem a cláusula `atividadeAplicada.escolaId` ou `entrega.escolaId`, a chamada `ler(a, b.professora, b.anoLetivoId)` devolve os itens da B e o teste quebra.
- Sem a cláusula do ano, `ler(a, a.professora, b.anoLetivoId)` devolve os itens da A e o teste também quebra.
- No caso S9, remover turma, disciplina, usuário, papel ou estado do `#daProfessora` quebra o teste com a professora de Física, a colega do 2ºC, a professora com vínculo pendente e o vínculo de aluno.
- As mutações declaradas em `3_task.md` cobrem cada uma dessas cláusulas.

Bloqueantes: nenhum

Recomendações:
- `semana.repository.ts`, `itensDaSemana` e `consultasDosItens`: o `anoLetivoId` chega por argumento. Hoje a origem dele é segura, e o caso R2 prova que um ano trocado volta vazio por causa da escola. Mesmo assim, o repository poderia ler o ano direto de `currentContext()` ou recusar um ano diferente do contexto. Isso tiraria a dependência de quem chama, e o mesmo padrão já existe nos métodos da 2.0.
- `#daProfessora`: as cláusulas `vinculo.escolaId` e `vinculo.anoLetivoId` comparam com a linha, e não com o contexto. Elas são redundantes, como a tarefa já registra. Comparar com `requireEscolaId()` deixaria a intenção mais clara para quem ler depois.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 20:42:53 · `tasks/prd-semana-do-professor/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 3.0 só lê. `SemanaRepository.itensDaSemana` e `consultasDosItens`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts:215-265`, fazem só `select` em `atividade_aplicada`, `artefato`, `entrega` e `vinculo`. Os `insert` diretos do teste `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana-itens.int.test.ts:340-360` vão para `atividade_aplicada` e `entrega`, servem só para dar volume ao `EXPLAIN` e são desfeitos num `rollback`. Nenhum toca `nota`. Todos com autor humano? Sim, porque não há caminho de escrita.

Decisão autônoma sobre aluno: ausente. O item informa só que algo aconteceu (atividade aplicada, atividade encerrada, correção). Não traz aprovação, reprovação nem encaminhamento.

Aprovação registrada: ok. O item `correcao` só mostra o estado de hoje da `entrega`: `pendente`, que aparece como "Para revisar", `aprovada` ou `rejeitada`. Não aprova nada nem cria um atalho para aprovar. A decisão continua no fluxo da entrega, com autor, data e justificativa garantidos pelos checks em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/entrega.ts:102-104`. O check `entrega_funcao_do_tipo` (`entrega.ts:95`) liga `lote_de_correcao` a `correcao_de_objetiva`. Com isso, nenhum item de correção de discursiva ou redação chega à Semana, e a D55 e o item 8 estão atendidos. O rótulo "Correção do Assistente" deixa claro que a saída é da IA.

Supervisão do tutor: não se aplica. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, sem mudança. A tarefa não cria agente nem muda o nível de nenhum.

Itens 7, 8 e 9 (supervisão não é vigilância, medir o professor não é vigiar, recusar a ferramenta não gera indicador):
- O item não traz nome de aluno, nota, acerto nem autor. O contrato é estrito (`itemDoDiaSchema`), e `comoItem` monta só as chaves dele (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/montar-dias.ts:53`). O teste confere as chaves exatas e confere que título e rótulos não usam palavras de nota (`semana-itens.int.test.ts:197-212`).
- Não há contagem, total, ranking nem nada sobre comportamento.
- A leitura se limita à própria professora: só os vínculos `confirmado` de professor da sessão, na turma e na disciplina (`semana.repository.ts:189`). A coordenação não alcança essa leitura.

Bloqueantes: nenhum.

Recomendações:
1. Tarefa 8.0 (tela): o item "Correção do Assistente · Para revisar" deve levar à tela de revisão do lote. Lá ficam os fora da curva abertos antes (D33) e o registro da validação (D56). Não pode haver botão de aprovar direto na Semana.
2. Tarefa 8.0: na revisão com fotos da tela, conferir que o selo de IA aparece no item de correção e que nenhuma tela mostra um total de correções pendentes que funcione como meta (D64).
3. Se algum dia entrar na Semana uma `entrega` de outra função (por exemplo, devolutiva formativa de discursiva, D46), o filtro `eq(entrega.tipo, 'lote_de_correcao')` (`semana.repository.ts:243`) passa a ser a única barreira contra mostrar o que a D55 proíbe. Nesse caso, ele precisa de teste próprio, e não pode depender só do check do banco.

`docs/regulacao.md` não mudou nesta tarefa e não pede nada novo.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 20:43:09 · `tasks/prd-semana-do-professor/3_task.md`

VEREDITO: APROVADO

A tarefa 3.0 não grava nada novo. Ela só lê `atividade_aplicada`, `artefato` e `entrega`, e cada item da semana leva apenas os ids, o título e o estado.

**Campos pessoais tocados:** nenhum campo novo nem migration. Cada item expõe só `tipo`, `turmaId`, `disciplinaId`, `atividadeAplicadaId`, `titulo` (o título do artefato, escrito pela professora) e `estado`, este só na correção. Nenhuma das três consultas lê nota, acerto, aluno, `aplicadaPor`, `decididaPor` ou `justificativa` (`packages/core/src/semana/semana.repository.ts:594` e `:607`). A atividade aplicada é da turma, nunca de um aluno: `artefato.ts:27-28` diz que nenhuma coluna liga aluno a adaptação.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok.
- **Escola:** vem do contexto (`requireEscolaId()`, `semana.repository.ts:591`).
- **Ano:** vem de `anoEmCurso()`, que também lê o contexto (`semana.service.ts:30`).
- **Pessoa:** o `#daProfessora` (`semana.repository.ts:564-581`) exige um vínculo `confirmado`, com papel `professor`, da pessoa da sessão, na turma da aplicação e na disciplina do artefato.
- **Troca de id na URL:** a rota só recebe `segunda`, então não há id para trocar.
- **Testes:**
  - O R2 roda o repository com o contexto da A e os ids da B, e volta vazio.
  - O S9 cobre a professora de outra disciplina, a de outra turma, a de vínculo pendente e o vínculo com papel de aluno.
  - As mutações declaradas cobrem cada cláusula de escopo.
- **Quem chama:** coordenação, rede e aluno têm `nunca` em `aula.ler` (`semana.controller.ts:16`).

**Contrato:** a saída é montada explicitamente em `comoItem` (`apps/api/src/semana/montar-dias.ts:439`) e conferida por `semanaResponseSchema.parse`, com `strictObject`. O teste confere as chaves exatas e procura nome de aluno e de professora no JSON (`apps/api/test/semana-itens.int.test.ts:849-856`).

**Logs:** limpos. Nenhum logger novo no repository, no service nem na montagem.

**Auditoria:** não se aplica. É a professora lendo as próprias turmas, sem coordenação nem rede, sem exportação e sem mudança de nota ou de permissão.

**Envio externo:** nenhum. Nada vai a provedor de IA nem a `ExecucaoAgente`.

**Seed/fixture:** sintético. Os nomes são "Professora Sintética Helena Prado" e "Aluno Sintético Caio Moreira" (`apps/api/test/escola-assistente.fixture.ts:31-32`), e a conta do R2 usa e-mail em `@professores.invalid`. O volume do `EXPLAIN` é gerado e desfeito no fim da transação.

**Pergunta de fechamento:** não muda. Nada novo é guardado sobre o aluno nem enviado para fora. As tabelas lidas já estavam no mapa e no arquivo do titular.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O comentário de `aula` em `packages/shared/src/permissao/matriz.ts:109-113` diz alcance `proprio`. Com a 3.0, o `GET /v1/semana` passa a trazer também a atividade aplicada pela colega da mesma turma e disciplina. O teste em `semana-itens.int.test.ts:803-804` prova isso e é coerente com quem já lê a atividade da turma, mas vale anotar no comentário que os itens seguem `turma_vinculada`. Assim o próximo revisor não lê o `proprio` como se valesse para tudo.
2. O título do item é texto livre da professora, até 160 caracteres. Se um dia a tela de criação aceitar título com nome de aluno (por exemplo "Recuperação do Caio"), ele aparece aqui. A regra de "título sem dado de aluno" fica para o conteúdo da ferramenta, não para esta leitura. É um registro para a retro.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 20:43:10 · `tasks/prd-semana-do-professor/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A tarefa só adiciona leitura ao `GET /v1/semana`, que a professora abre algumas vezes no dia. Não toca login, tutor, sala, prova, fila, IA nem migration.
Rate limit: ok. A rota segue no limitador por usuário e por escola da 2.0, e o teste sobe a API com `LIMITE_REQ_USUARIO_MIN` e `LIMITE_REQ_ESCOLA_MIN`. Nada é limitado por IP.
Fila e prioridade: ok. Não há job. A leitura são três consultas em sequência, sem nada demorado no request.
Concorrência: protegida. Só há leitura: nenhum "busca, verifica, grava" e nenhuma escrita.
Índice e paginação: ok. Rodei o `EXPLAIN` de `apps/api/test/semana-itens.int.test.ts:340` e os 14 casos passaram. A consulta parte do vínculo da professora e desce por `(escola_id, ..., turma_id)`: `atividade_aplicada_escola_ano_turma_id_unico` na atividade aplicada e `entrega_turma_idx` na entrega. Não há leitura da tabela inteira. Também não há paginação, mas a semana já limita o resultado às turmas e disciplinas dos vínculos da professora.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. A rota já existia, é medida pela métrica HTTP geral e a tarefa não cria alerta novo.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts:67` (`diaNoFuso` aplicado em `naSemana`): o filtro da semana passa `to_char(... at time zone ...)` em cada linha da turma, e assim nenhum índice de tempo serve. Hoje o custo é pequeno, porque o volume por turma no ano é de centenas de linhas. Vale converter segunda e domingo para instantes no fuso da escola e filtrar `aplicada_em >= $inicio and aplicada_em < $fim`, deixando o `to_char` só no `select` do dia. Assim a consulta já fica pronta se um dia entrar um índice `(escola_id, turma_id, aplicada_em)`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana-itens.int.test.ts:357-358`: o `EXPLAIN` roda com `enable_seqscan` e `enable_bitmapscan` desligados. Isso prova que existe um caminho pelo índice com escola e turma, mas não que o planejador o escolhe com as estatísticas reais. Vale um comentário dizendo isso, ou uma segunda leitura do plano sem os dois `set local`, só para registro.
- O cenário de carga não inclui a abertura da Semana pelos professores às 7h30. Não é caminho quente de aluno, mas a leitura agora tem nove consultas. Vale incluí-la no cenário `rajada` quando a 8.0 trouxer a tela.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 20:43:11 · `tasks/prd-semana-do-professor/3_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As subtarefas 3.1, 3.2 e 3.3 estão feitas. A tarefa não mexe em `packages/shared`, nem no `PUT` (4.0), nem na tela (8.0).

Aderência à Tech Spec: ok. As quatro divergências da tabela estão na `techspec.md`: §2, §5 "Ler" passo 5 e §7c. As que mudam cenário estão também no `cenarios.md`: o S9 e a linha do `EXPLAIN`.

Portão local: carimbo válido. O `conferir` respondeu "válido para o código atual", com typecheck, lint, segredo, dependencias, unidade e alvo.

Bloqueantes: nenhum.

Recomendações:
- **Ordem dos itens e dia fora da semana fora do `cenarios.md`.** A ordem no dia (aplicada, encerrada, correção, depois título e atividade) e a regra "o dia que a semana não traz não mostra item" estão na `techspec.md` §5 e no `montar-dias.test.ts`. O `cenarios.md` não registra nenhuma das duas, e a divergência 2 da `3_task.md`, linha 78, diz que elas estão em "S9 e S10". Convém pôr no S9 ou criar uma linha [U].
- **Contagem de consultas desatualizada.** A `techspec.md` §7c, linha "Carga na manhã de segunda", ainda fala em "cinco consultas indexadas". Com as três dos itens, a leitura passa de nove consultas em sequência. Isso não é bloqueante para a regra 80, porque o `EXPLAIN` prova que cada consulta desce pelo índice. Mas o número precisa ser corrigido, para o `infra-guardian` e a retro lerem o valor certo.
- **Método público só para o teste.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts:216` (`consultasDosItens`) é público só para o `EXPLAIN` ler o SQL montado, e deixa construtores de consulta expostos na API do repository. Se outro repository já tiver um jeito de mostrar a consulta ao `EXPLAIN`, convém seguir esse padrão. Senão, vale um comentário dizendo que o método é só para o teste.
- **`sql.raw` no fuso.** `semana.repository.ts:67` monta o fuso com `sql.raw`. Hoje é seguro porque `FUSO_DO_USO` é constante. Passar o valor como parâmetro (`at time zone ${FUSO_DO_USO}`) tira o `raw` sem mudar o comportamento.
- **Comentário que repete o teste.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/montar-dias.test.ts:187`: o comentário só repete o que a asserção logo abaixo já mostra.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 20:44:26 · `tasks/prd-semana-do-professor/3_task.md`

VEREDITO: APROVADO

Rodei as duas suítes da tarefa e as duas passaram: `apps/api/test/semana-itens.int.test.ts` (14 de 14) e `apps/api/src/semana/montar-dias.test.ts` (17 de 17). Não alterei nenhum arquivo.

**Cenários exigidos:**
- **Caminho feliz:** S9, a atividade aplicada na quarta aparece na quarta da turma e da disciplina da professora.
- **Casos de borda do domínio:** feriado no dia da prova (S10, e o recesso na unidade); fuso, com a aplicada às 22h de domingo em Brasília; os extremos da semana (domingo 23h59 anterior e segunda 0h seguinte); lote criado fora da semana; atividade aplicada numa semana e encerrada noutra; correção aprovada depois da semana mostrando o estado de hoje; atividade aplicada a outra turma da professora; entrega de outro tipo na mesma turma.
- **Permissão:** a colega de outra disciplina na mesma turma; a de Química de outra turma; quem tem vínculo `pendente`; quem tem vínculo de papel aluno na disciplina.
- **Isolamento:** R2, a mesma conta nas duas escolas, pela rota e pelo repository com o contexto da A e os ids da B.
- **Contrato e carga:** as chaves exatas do item, sem nota, acerto, nome nem autor; o `estado` só na correção; o `EXPLAIN` das três consultas (regra 80, item 8).
- **Concorrência:** não se aplica. A tarefa só lê, sem escrita nem job.

**Cobertos:**
- **Tabela de testes:** cada uma das 16 linhas tem o seu caso, citado pelo nome. Os itens juntos por parênteses ou ponto e vírgula também estão cobertos: a `deFisica` com os três itens, a `comPendente`, a quinta sem feriado e os quatro extremos da semana.
- **Mutações:** conferi os 22 blocos contra o `git diff`. Cada cláusula nova de filtro tem bloco, e o teste citado chega a ela pelo caminho certo:
  - **Vínculo:** turma, disciplina, pessoa, papel e estado do `#daProfessora` caem cada um numa sessão diferente do mesmo laço, em `semana-itens.int.test.ts:148`.
  - **Escola e ano:** os filtros da atividade aplicada e da entrega são pegos pelas leituras do repository no R2 (`:331` e `:333`).
  - **Período:** a ponta da segunda e a do domingo são vistas pelo repository direto (`:267` a `:274`). Na rota, a montagem dos dias esconderia a mutação, e esse cuidado está no teste.
  - **Fuso:** é pego também com a sessão do banco em UTC (`:244`), então não depende do fuso do servidor.
- **Cláusulas sem bloco:** as três têm o motivo escrito no documento e o motivo se confirma. A escola e o ano dentro do `exists` já são garantidos pela turma. O `tipo = 'lote_de_correcao'` é coberto pelo `check` `entrega_alvo_do_tipo` junto com o `inner join`.
- **Asserções:** todas são sobre o resultado (ids, tipos, estados, chaves), e não só sobre a resposta 200.
- **Limpeza:** não há `.skip`, teste comentado nem mock de código nosso. A tarefa não chama IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Duas disciplinas confirmadas na mesma turma.** Hoje esse caso só é provado pelo lado negativo (Física confirmada e Química pendente). Falta o lado positivo: a professora com as duas confirmadas no 2ºB e uma atividade em cada. Ela deve ver os dois itens, cada um com o seu `disciplinaId` e sem duplicar. É o que justifica usar `exists` em vez de `join` (`packages/core/src/semana/semana.repository.ts`, `#daProfessora`).
2. **Lote rejeitado e lote novo da mesma atividade.** O índice parcial em `packages/core/src/db/schema/entrega.ts:88` (`estado <> 'rejeitada'`) permite um lote novo depois da rejeição. Na mesma semana, saem duas correções com o mesmo título e o mesmo `atividadeAplicadaId`, e o desempate em `montar-dias.ts` (`naOrdemDosItens`) não as separa. Vale um caso que defina o esperado: as duas, só a vigente, ou a ordem entre elas.
3. **Título na checagem de vocabulário.** Em `semana-itens.int.test.ts:207`, o `expect(item.titulo).not.toMatch(VOCABULARIO_DE_NOTA)` confere um título que o próprio teste escolheu. Só falharia se o código acrescentasse texto ao título. A parte que prova a regra é a do `rotuloDoItem`. Convém dizer isso no nome do caso ou num comentário, para a validação não contar o título como prova.
4. **Seleção de índice no `EXPLAIN`.** O teste (`:357` e `:358`) desliga `seqscan` e `bitmapscan`, como a casa já faz em `arquivo-do-titular.int.test.ts`. Assim ele prova que existe um índice utilizável pelo escopo, e não que o planejador o escolhe com a configuração padrão. O documento e a divergência 3 precisam dizer isso com essas palavras.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 21:19:24 · `tasks/prd-semana-do-professor/3_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O novo caso da professora com Química e Física está em S9 do `cenarios.md`. A §7c agora diz "dez consultas, em sequência", e isso bate com sete consultas da 2.0 mais três dos itens. A divergência 3 do `3_task.md` explica o que o `EXPLAIN` com `seqscan` e `bitmapscan` desligados prova e o que não prova. Ela já constava da `techspec.md` §7c e do `cenarios.md`.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

As quatro recomendações que a ordem mandou aplicar foram feitas:
- **S9 no `cenarios.md`:** traz a ordem do dia e o dia que a semana não traz, os dois marcados [U]. Também traz o caso novo das duas disciplinas confirmadas.
- **§7c da `techspec.md`:** diz dez consultas.
- **`consultasDosItens` em `semana.repository.ts`:** o comentário diz que ela é pública só para o `EXPLAIN` de `semana-itens.int.test.ts`.
- **`montar-dias.test.ts`:** o comentário que repetia a asserção saiu.

O `it` novo de `apps/api/test/semana-itens.int.test.ts` (linhas 151-167) usa `toEqual` sobre a lista exata. Assim ele quebra se o `exists` virar `join` e duplicar o item, e também se a disciplina vier da turma em vez do artefato. A ordem esperada, Física antes de Química, sai do desempate pelo título, como a divergência 2 descreve.

Recomendações:
- O `3_task.md`, em "Recomendações sem aplicar", manda quatro itens para o `TODO.md`:
  - ler o `anoLetivoId` do contexto;
  - o `to_char` por linha em `naSemana`/`diaNoFuso`;
  - o `sql.raw` do fuso;
  - o comentário de `aula` em `matriz.ts`;
  - a barreira do `entrega.tipo` quando outra função de entrega entrar na Semana.

  O `TODO.md` não mudou nesta árvore, e não há seção "Da semana-do-professor, tarefa 3.0". Na 2.0 a seção entrou no próprio commit da tarefa. Antes do commit, registre esses itens lá, para que o destino declarado exista.
- `packages/core/src/semana/semana.repository.ts:87`: a primeira linha do JSDoc de `consultasDosItens` ficou bem mais longa que as outras do bloco. Quebre no mesmo comprimento das vizinhas.

Arquivos auditados nesta rodada:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/test/semana-itens.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/semana/semana.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/api/src/semana/montar-dias.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/3_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/TODO.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 21:19:27 · `tasks/prd-semana-do-professor/3_task.md`

VEREDITO: APROVADO

Cenários exigidos: esta é a 2ª rodada. Confiro as três recomendações que a ordem mandou aplicar (1, 3 e 4) e o diff `963c2736…` → `06a59546…`. A 2 foi para a tarefa 8.0.

Cobertos:
- **Recomendação 1, a professora com as duas disciplinas confirmadas na mesma turma.** O caso novo está em `apps/api/test/semana-itens.int.test.ts:151-167` ("S9: a professora com Química e Física confirmadas no 2ºB vê as duas atividades…"). A professora tem os dois vínculos confirmados no 2ºB. Uma atividade é de Química, aplicada pela própria professora. A outra é de Física, de um artefato de Física com `disciplinaId: a.fisica` (a fixture aceita a opção, `atividade.fixture.ts:36,46`), aplicada pela colega de Física. A asserção confere a lista exata de `[tipo, disciplinaId, atividadeAplicadaId, titulo]`, então pega item faltando, item duplicado e disciplina trocada. A linha da tabela de testes do `3_task.md` cita o caso pelo nome, e o S9 do `cenarios.md` o inclui.
- **Recomendação 3, o título na checagem de vocabulário.** O nome do caso mudou para "…e o rótulo do item não tem palavra de nota". Há um comentário em `semana-itens.int.test.ts:225` dizendo que é o rótulo que prova a regra 70 e que o título só confere. A linha da tabela foi ajustada. A descrição ficou honesta: o título é escolhido pelo próprio teste e só falharia se o código acrescentasse texto a ele.
- **Recomendação 4, o `EXPLAIN` com `seqscan` e `bitmapscan` desligados.** O teste tem o comentário em `semana-itens.int.test.ts:376-377`, e a divergência 3 do `3_task.md` traz o mesmo texto. Ficou declarado que o teste prova que existe um caminho pelo índice com a escola e a turma, e não que o planejador o escolhe com a configuração padrão.
- **O resto do diff.** O comentário a menos em `montar-dias.test.ts` não muda nenhuma asserção. O `semana.repository.ts` mudou só em comentários. O `techspec.md` §7c e o `cenarios.md` mudaram só em texto. A seção "Mutações" mudou só na quebra de linha. Nenhum código de produção mudou, então não há cláusula nova que precise de bloco.
- **Execução.** `npx vitest run apps/api/test/semana-itens.int.test.ts`, rodado da raiz, passou com 15 de 15 casos. Rodado de dentro de `apps/api`, não carrega por um erro de resolução do `@educa/core`; isso é de onde o comando roda, não do teste.
- Não há `.skip`, teste comentado nem mock da regra no diff.

Bloqueantes: nenhum.

Recomendações:
- A linha nova da tabela em `tasks/prd-semana-do-professor/3_task.md:41` justifica o caso por "`exists` e não `join`". O caso não separa as duas formas. Um `join` com `vinculo` pela turma **e** pela disciplina também devolveria cada atividade uma vez só, porque só um vínculo casa com cada par (turma, disciplina). O que o caso prova é o lado positivo: a condição da disciplina não derruba a segunda disciplina legítima, e não há duplicata. Vale trocar a coluna para "duas disciplinas, uma vez cada", ou registrar na retro que a diferença entre `exists` e `join` não tem dado que a mostre.
