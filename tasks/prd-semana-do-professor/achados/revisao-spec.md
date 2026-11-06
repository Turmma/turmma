# Achados das revisões — `tasks/prd-semana-do-professor/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-06 13:18:54 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: APROVADO

Tela vista: não. É revisão de spec, sem código nem foto. A tela será vista na validação, nos projetos `chromebook` e `celular`.

Estados: ok. O PRD RF12 garante os quatro estados, e o texto "Tentar de novo" e os três vazios dizem o motivo e o próximo passo. A Tech Spec seção 9 não os repete: o carregando e as mensagens de erro ficam implícitos e são cobertos só pelo e2e (seção 10, "os três vazios"). A gravação que falha ("devolve erro, e o painel guarda o texto", seção 5) não traz a frase ao usuário.

Acessibilidade: implícito, não garantido pela seção 9. A seção 9 não diz nada sobre:
- foco, ao abrir e ao fechar o `Sheet`;
- rótulo do `Textarea`;
- contador anunciado;
- "Hoje" e "aula em andamento" marcados também em texto;
- cartão de aula operável por teclado.

Os componentes da casa (`Sheet`, `Textarea`, `SegmentedControl`, `Tabs`) cobrem boa parte disso. A regra 50 item 3 pede que a seção 1.8 de `docs/interface.md` diga o resto.

Chromebook fraco: garantido. A seção 9 define cartões empilhados sem régua, sem virtualização para umas 40 aulas, pedaço carregado sob demanda e uma leitura com cinco consultas indexadas (seção 7c). A altura segue o miolo da X3, sem `calc(100dvh …)`. Não há upload de imagem. A seção 10 não pede o teste com throttling de rede e CPU que a regra 50 item 5 pede.

Celular: garantido no desenho. A seção 9 usa `SegmentedControl` com um dia por vez abaixo de 768 px e folha de baixo no painel. O e2e roda em `celular` (seção 10), e nada depende de hover. Faltam os alvos de toque: 44 px em "Salvar" e "Preparar esta aula", 24 px nos cartões e nos botões de semana. A seção 1.8 deve escrevê-los.

Ação oficial protegida: sim, no sentido de que não se aplica. A Semana não aprova, publica, exclui nem exporta. "Preparar esta aula" só abre o Início, sem gerar nada. Os itens do dia levam à revisão existente, onde a aprovação já mostra valor, aluno e avaliação.

Os itens do checklist, um a um:
- **Feed de agentes:** não se aplica. A Semana não é a primeira tela.
- **Seletor de escola:** garantido. É o seletor existente. O RF9 e a seção 9 mandam descartar o cache e fechar o painel cuja aula sumiu ao trocar de escola.
- **Português do Brasil:** implícito. Os textos do PRD estão em português. Falta dizer o formato de data ("9 a 13 de novembro") e o rótulo em português para `aplicada`, `encerrada` e `correcao`, para o valor do contrato não vazar.
- **Erro que diz o que fazer:** garantido na leitura, com "Tentar de novo". Não está definido na gravação nem na aula que some por reimportação.

Bloqueantes: nenhum.

Recomendações, para a seção 1.8 de `docs/interface.md` e para as tarefas:
1. **Erros da gravação (Tech Spec seção 5, "Falhas", e seção 9).** Escreva a frase de falha ("Não foi possível salvar. Tente de novo em instantes"). Escreva também o caso em que `PUT` devolve `NAO_ENCONTRADO` porque a reimportação removeu a aula com o painel aberto. Hoje a spec só diz que o painel fecha, e o rascunho não digitado se perderia sem aviso. A mensagem deve dizer que essa aula saiu da grade e que o texto não foi salvo.
2. **Rascunho e troca de escola (seção 9).** O RF9 exige que nada da escola anterior fique na tela nem no cache. O rascunho mora num "store de aba", e a seção 9 só fala do cache do TanStack Query. Diga que o store também é esvaziado na troca de escola. O rascunho é texto livre da professora e pode ter nome de aluno.
3. **Acessibilidade (seção 9).** Registre:
   - "Hoje" e "em andamento" com rótulo em texto, não só cor;
   - cada aula como botão com nome acessível ("Terça, 7h30, 7ºA, Matemática");
   - foco que volta ao cartão ao fechar o painel;
   - rótulo no `Textarea` e contador anunciado com `aria-live="polite"`;
   - o selo "Falta preencher" em texto neutro, sem urgência (D59).
4. **Teste (seção 10).** Inclua o e2e a 360 px com a regra de alvo de toque e o perfil com throttling da regra 50 item 5. Inclua também a semana com 40 aulas em CPU reduzida.
5. **Texto do contrato (seção 4).** Mapeie `aplicada`, `encerrada` e `correcao` e os estados em português numa só tabela do front, testada. Defina a data e a semana no formato local.
6. **Dia sem aula no celular.** O PRD RF12 dá "um dia por vez". Diga qual dia abre ao entrar: hoje, ou segunda quando hoje cai fora da semana. Diga também o que um dia de feriado mostra, o tipo e a descrição, para o vazio do dia convidar em vez de ficar em branco.

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-06 13:19:51 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `aula` (nova). Tem `escolaId`, `anoLetivoId` e `vinculoId` com FK composta `(escolaId, anoLetivoId, vinculoId) → vinculo` e `on delete cascade`. O id é UUID v7 (Tech Spec, seção 3). Tabelas reaproveitadas e conferidas no código: `alocacao`, `vinculo`, `evento_calendario` (as três com escola e ano). Tabelas lidas sem mudança: `atividade_aplicada` e `entrega`.

Queries verificadas (seção 5):
- **Ler:** vínculos, alocações, eventos, registros e itens.
- **Gravar:** confere o vínculo e a aula, depois `on conflict`.
- **Passo da grade:** re-chaveia o horário e apaga os registros futuros.
- **Arquivo do titular** (seção 2).
- **Matriz:** `aula` com `proprio` para o professor e `nunca` para coordenação e rede (seção 2).

A escola, o ano e a professora vêm do contexto e da sessão (seção 6). Nenhuma rota recebe `escolaId`. O `vinculoId` do corpo só vale depois de achado com escola, ano, usuário da sessão e `confirmado`. O inexistente e o alheio dão o mesmo `NAO_ENCONTRADO`. Não há `@Unscoped()` novo. A rede fica com `nunca`. A troca de escola limpa o cache pelo `resetQueries` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/web/src/main.tsx`.

Teste de isolamento: presente, mas não é efetivo para toda query nova (bloqueante 2).

Bloqueantes:

1. **O texto da aula chega à coordenação pelo arquivo do titular.** Fica em Tech Spec, seção 2, linha `packages/core/src/titular/leitura-do-titular.ts | alterado | a entrada aula`, e seção 7, "DTO de saída".
   - **O problema:** a spec põe `aula` no arquivo sem dizer em qual versão. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/titular/leitura-do-titular.ts:460`, toda leitura sem `naVersao` entra nas duas versões, também na `coordenacao`. A coordenação baixa essa versão por `POST /v1/privacidade/pedidos/:id/arquivo` quando o titular não tem conta ativa, como o professor que saiu (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/shared/src/permissao/matriz.ts:190-197`).
   - **O efeito:** o registro de aula do professor que saiu fica legível pela coordenação. Isso contradiz o RF11 e a seção 4 do PRD ("Nenhuma rota da coordenação ... devolve o texto") e a regra 70, item 8.
   - **Correção exigida:** a seção 2 ou a 7 declara `naVersao: (v) => v === 'completa'` para `aula`, do mesmo jeito que `thread_agente` e `mensagem_agente`. A seção 10 ganha um teste de integração: o arquivo da versão `coordenacao` de um professor sem conta ativa, com registro de aula, não traz o texto.

2. **A query de eventos da Semana não tem teste de isolamento.** Fica em Tech Spec, seção 6, item "Testes", e seção 5, "Ler", passo (3).
   - **O problema:** a consulta de `evento_calendario` da semana é nova no `SemanaRepository`. É a única leitura do GET que não passa pelo vínculo da professora: o escopo dela é só a cláusula escola + ano.
   - **Por que os testes listados não pegam:** eles afirmam que a professora "não recebe aula, registro nem item da outra" escola. Tire mentalmente a cláusula de escopo dos eventos: um feriado da escola B passa a apagar as aulas da escola A e a mostrar a descrição de B, e nenhum desses testes quebra.
   - **Correção exigida:** um teste de integração de isolamento em que a escola B tem um `feriado` e um `evento` na mesma semana. Com o token de A, o GET mostra as aulas de A nesse dia e não traz tipo nem descrição de B.

Recomendações:
- **Gravação com vínculo de outro ano:** a seção 6 diz que dá `NAO_ENCONTRADO` sem gravar, mas a lista de testes não traz esse caso. Acrescente o `PUT` com vínculo `confirmado` da mesma professora no ano anterior, para provar a cláusula `anoLetivoId`.
- **`on conflict` da `aula`:** acrescente `setWhere` com a escola do contexto, como faz `alocacao.repository.ts:51`. É uma segunda camada; a primeira já é a conferência do vínculo.
- **Passo da grade:** a seção 6 diz "nenhum método os recebe", mas esse passo precisa receber o ano de destino, como o `AlocacaoRepository`. Escreva isso, com a escola vinda do contexto do job.
- **Rascunho no store de aba (seção 9):** diga que ele é descartado na troca de escola, ou que a chave inclui a escola. Hoje nada impede que o texto da escola anterior fique guardado depois da troca, o que o RF9 proíbe.

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-06 13:20:06 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: **REPROVADO**

O desenho cumpre quase toda a regra 70, mas deixa uma brecha justamente no ponto que mais interessa: há um caminho da coordenação que chegaria ao "o que vou dar" da professora.

**Bloqueante.** Tech Spec, seção 2 (linha do `packages/core/src/titular/leitura-do-titular.ts`, "a entrada `aula`") e seção 7 ("o registro entra no arquivo do titular").

- **O que está errado:** a Tech Spec não diz em qual versão do arquivo do titular a `aula` entra. Na estrutura de hoje, uma entrada sem `naVersao` entra nas duas versões (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/titular/leitura-do-titular.ts:40`, "Sem isto, entra nas duas"). Uma delas é a versão `coordenacao`, que a coordenação baixa por `POST /v1/privacidade/pedidos/:id/arquivo` quando o titular está sem conta ativa (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/shared/src/permissao/matriz.ts:195`).
- **Quando isso acontece:** no caso que o próprio PRD descreve (seção 7, "Professor que saiu em março"). A linha da `aula` vive enquanto o vínculo encerrado não é expurgado. Nesse intervalo, a coordenação abre um pedido e recebe o texto de cada aula, com data e `atualizadoEm`.
- **O que isso viola:** RF11 ("nenhuma rota da coordenação ou da rede devolve o texto ou contagem"), PRD seção 3, regra 70 itens 8 e 9 e D64. Já existe um precedente para esse risco: o critério 5 do mesmo arquivo (linhas 28 a 31) tira da versão da coordenação `thread_agente`, `mensagem_agente` e a `introducao_vista_em` do professor, pelo mesmo motivo.
- **Correção exigida:**
  1. A seção 2 e a seção 7 declaram que a `aula` entra só na versão `completa` (`naVersao: (v) => v === 'completa'`). O critério 5 do arquivo ganha a `aula` com o motivo.
  2. As linhas da `aula` não entram em nenhuma contagem que a prévia ou a versão da escola mostrem, como `contagemPorCategoria` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/api/src/privacidade/titulares.repository.ts:170`.
  3. A seção 10 ganha os testes que provam isso:
     - unidade, no `leitura-do-titular.test.ts`: `naVersao('coordenacao') === false` e `naVersao('completa') === true` para a `aula`;
     - integração, no `arquivo-do-titular.int.test.ts`: uma professora sem conta ativa com aula preenchida; o JSON da versão `coordenacao` não contém o texto nem a tabela, e o da versão `completa` contém.
  4. A seção 6 inclui a rota de pedidos do titular entre as rotas que a coordenação tem e que não podem levar o texto. "Coordenação sem acesso" hoje só cobre a matriz da `aula`, não essa rota indireta.

**Item a item**

| # | Item | Situação |
|---|---|---|
| 1 | Nota com autor humano | Não se aplica. Nenhum caminho grava em `Nota`. A tabela nova é `aula` (só texto), e o passo novo no job da grade (seção 5) só re-chaveia ou apaga linhas de `aula`. |
| 2 | Decisão autônoma sobre aluno | Não se aplica. Não há IA nem decisão. RF8, "Preparar esta aula", só abre o Início com a turma, sem gerar nada (seção 9). |
| 3 | Aprovação registrada | Não se aplica. A Semana não produz saída de IA. RF7 só mostra o estado da `entrega` `lote_de_correcao` e manda para a revisão que já existe. Essa entrega é só de objetiva (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/db/schema/correcao.ts:14`), sem nota, acerto nem nome. |
| 4 | Supervisão do tutor | Não se aplica. |
| 5 | Autonomia declarada | Não se aplica: não há agente novo. |
| 6 | Auditoria responde | Não se aplica. Não há saída de IA. O texto fica fora da auditoria (seção 7 e desvio da seção 11). Isso ajuda o item 8, porque a auditoria da escola não vira registro de quando a professora planeja. |
| 7 | Supervisão não é vigilância | Não se aplica ao aluno: RF7 não traz nome de aluno. |
| 8 | Sem nota proposta em discursiva e redação (D55) | Garantido. Nenhum campo nem tela da Semana toca discursiva. |
| 9 | Medir o professor não é vigiar (D45, D64) | Garantido em quase tudo, **menos no arquivo do titular** (o bloqueante). O que já está certo: matriz `aula` com professor `proprio` e os outros `nunca` (seções 2 e 6); nenhuma contagem de aulas preenchidas; "Falta preencher" só para ela; prévia, resumo e auditoria da reimportação sem mudança (seção 5); nenhum log com o texto; nenhuma conversa nova gravada pelo "Preparar". |

**Formato**

```
VEREDITO: REPROVADO
Caminhos de escrita em Nota: nenhum (a spec não escreve em Nota; o passo novo no job da grade só toca `aula`) — todos com autor humano? sim (não se aplica)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (não se aplica: sem saída de IA; RF7 só mostra o estado do lote de objetiva já aprovado ou pendente)
Supervisão do tutor: ok (não se aplica)
Autonomia declarada e visível: sim (não se aplica: sem agente novo)
Bloqueantes:
- Tech Spec seções 2 e 7 ("a entrada `aula`" no arquivo do titular): a versão não é declarada, e o padrão é entrar nas duas (leitura-do-titular.ts:40). Assim a versão `coordenacao`, que a coordenação baixa pela rota de pedidos (matriz.ts:195) quando o professor saiu, levaria o texto e as datas das aulas, contra RF11, a regra 70 itens 8 e 9 e a D64. Correção: `aula` só na versão `completa` (naVersao), citada no critério 5; nenhuma contagem da `aula` em categoria que a prévia ou a versão da escola mostrem; teste de unidade (naVersao) e de integração (JSON `coordenacao` sem o texto, `completa` com ele) na seção 10; a rota de pedidos entre as rotas que a coordenação tem e que não podem levar o texto, na seção 6.
Recomendações:
- Seção 10: no teste dos quatro casos de RF14, conferir que o resumo, a prévia e a auditoria da reimportação da grade não trazem contagem nem menção a registros de aula re-chaveados ou apagados. A seção 5 garante isso em texto, mas a tela que a coordenação vê depois da reimportação é onde um "N planejamentos apagados" pareceria útil a quem implementa.
- Seção 2: citar a entrada da `aula` em `CLASSIFICACAO_DAS_TABELAS` (packages/shared/src/privacidade/classificacao.ts), com categoria e ligação pelo `vinculo_id`. O teste de arquitetura exige essa entrada, e é ela que decide a contagem por categoria.
- Seção 9: deixar escrito que "Falta preencher" é só o selo por aula, sem total da semana nem contador ("3 aulas sem texto"), nem para a própria professora (D59: lembra, não cobra). Também que a F11 não pode virar esse selo em número sem passar de novo por esta revisão.
- Seção 7b: trocar a frase única por uma linha por item da regra 70 (8, 9 e 7). Assim quem lê sabe que o arquivo do titular é a única porta indireta que existe hoje e como ela está fechada.
```

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/titular/leitura-do-titular.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/shared/src/permissao/matriz.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/api/src/privacidade/titulares.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/shared/src/privacidade/classificacao.ts`

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-06 13:20:55 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: fila (passo novo no job `estrutura.gravar-planilha`, já na fila e com o limite por escola de hoje) e migration (só cria tabela). Leitura e gravação da Semana ficam fora do caminho quente: são cerca de 400 professores nas dez escolas, menos de 1 req/s às 7h.
Rate limit: ok. A guarda global por usuário e por escola (`apps/api/src/rate-limit.module.ts`) cobre as duas rotas (seção 7c).
Fila e prioridade: ok. Não há job novo, e o passo roda dentro da transação do job do F2.
Concorrência: corrida na seção 5, "Gravar", no ramo "ou um registro passado já gravado", contra o passo da grade da mesma seção, "Reimportar a grade".
Índice e paginação: ok. `aula` tem (escola, ano, vínculo, data). As consultas de leitura ficam presas à semana e às turmas do vínculo, então não há listagem que cresça sem limite.
Degradação de IA: não se aplica
Migration: compatível. Só cria `aula`, a FK composta usa a `vinculo_escola_ano_id_unico`, que já existe, e não toca tabela com dado.
Métrica e alerta: ok. Não há alerta novo, e a `http.server.request.duration` por rota já mede as duas rotas.

Bloqueantes:
1. **Tech Spec, seção 5 "Gravar" e seção 7c "Corridas de concorrência".** A corrida 2 só protege o ramo da alocação. O ramo do registro passado fora da grade confere a existência sem trava e depois grava com `insert … on conflict (vinculo_id, data, inicio) do update`. É o padrão "busca, verifica, grava" (regra 80, item 7).
   - **Cenário:** numa segunda passada, há o registro R1 às 7h30, dentro da grade, com o texto "A", e o registro R2 às 7h40, fora da grade. A reimportação passa as 7h30 para as 7h40. O job apaga R2 ("sai antes") e re-chaveia R1 para 7h40. Ao mesmo tempo a professora corrige R2. A gravação já tinha lido R2 e espera o commit do job no índice único. Depois disso o `on conflict` encontra R1 re-chaveado e grava o texto de R2 em cima dele. O texto "A" se perde e o `PUT` responde sucesso.
   - **Variante:** se o job re-chaveia sem que haja registro no início novo, a gravação recria uma linha "fora da grade" no início velho, ao lado da que foi re-chaveada.
   - **Correção exigida, uma de duas:**
     - No ramo do registro passado, travar a linha (`select … for update`) e gravar com `update … where id = <travada>`, sem `insert on conflict`. Se nenhuma linha for afetada, responder `NAO_ENCONTRADO`.
     - Ou a gravação e o passo da grade tomam a mesma trava por vínculo antes de ler ou escrever em `aula`. Pode ser um `pg_advisory_xact_lock` sobre o vínculo, ou `for share` na linha do `vinculo` pela gravação e `for no key update` nos vínculos afetados pelo passo do job.
   - **Teste:** acrescentar na seção 7c a corrida 3 (gravação do fora da grade contra o re-chaveamento) e na seção 10 o teste de integração em paralelo. Ele precisa terminar sem texto sobrescrito e sem registro duplicado no início velho.

Recomendações:
- **Seção 5 "Gravar".** A gravação pode esperar a transação inteira do job no `for key share`, segurando uma conexão do pool até o `statement_timeout`. Usar `SET LOCAL lock_timeout` curto e responder com um erro que pode ser repetido, já que o painel guarda o texto.
- **Seção 5 "Reimportar a grade", "um registro fora da grade que já ocupe o início novo sai antes".** Isso apaga um texto passado, e o PRD RF14 diz que "a aula passada com texto continua na semana dela, mesmo fora da grade". Está fora da minha lista. O caminho é levar ao `test-engineer` ou ao Joaquim para decidir: ou o PRD aceita essa perda explicitamente, ou a colisão é resolvida sem apagar, por exemplo juntando os dois textos.
- **Seção 7c "Métrica" e PRD seção 9, terceira métrica.** O PRD promete "a leitura da Semana dentro do orçamento da regra 80 às 7h", e a Tech Spec não diz como isso é verificado. Ou o `GET /v1/semana` entra no cenário `rajada` do teste de carga, ou a métrica sai do PRD.
- **Seção 5 "Ler", passo (5).** Registrar na tarefa o `EXPLAIN` da consulta de itens (`atividade_aplicada` com `artefato` por turma e disciplina, e `entrega` `lote_de_correcao` por atividade). Ela deve usar `atividade_aplicada_turma_idx` e `entrega_turma_idx`, sem varrer a escola.
- **Seção 5 "Gravar".** A gravação lê o vínculo `confirmado` sem trava, e um encerramento concorrente deixa um registro num vínculo encerrado. É inofensivo, porque fica invisível e sai em cascata. Uma linha na seção 7c registrando que é aceito evita que a próxima revisão reabra o assunto.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/tipos/grade.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/alocacao.repository.ts`

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-06 13:21:16 · `tasks/prd-semana-do-professor/revisao-spec.md`

**VEREDITO: REPROVADO**

A Tech Spec acerta em quase tudo: o escopo vem do token, a mesma resposta vale para "não existe" e "não é dela", a coordenação e a rede ficam com `nunca`, não há IA no caminho e os logs levam só ids. Ela reprova porque cria um campo de texto livre do professor, `aula.conteudo` (até 500 caracteres), e deixa de dizer duas coisas que a regra 20 exige dele: o que acontece com ele no arquivo do titular que a coordenação baixa, e o que acontece com ele quando um aluno é eliminado.

**Campos pessoais tocados:** um só novo, `aula.conteudo`, com titular professor. O resto é derivado ou lido de tabelas que já existem: a `alocacao` e o vínculo; os nomes de turma e disciplina e a sala; o título do artefato e o estado da entrega nos itens do dia. Nenhum campo proibido para aluno aparece, e não há necessidade específica nem diagnóstico.

**Fora da tabela de dados do docs/lgpd.md:** `aula.conteudo` ainda não está na tabela. A Tech Spec (seção 7) dá a finalidade e a retenção e põe a linha na própria tarefa da tabela, o que a regra 20, item 1, aceita. A linha precisa dizer três coisas: que o texto pode trazer nome de aluno, que não vai a provedor de IA nesta fase, e como o nome sai na eliminação (bloqueante 2).

**Autorização por objeto:** ok, nas seções 5 e 6.
- O `vinculoId` do corpo só vale se o repository o achar com a escola, o ano e o usuário da sessão, e com o vínculo `confirmado`. A FK composta é a segunda camada.
- Trocar o id na URL dá a mesma resposta (`NAO_ENCONTRADO`) para outra escola, colega, vínculo pendente, contestado ou encerrado, outro ano e id inexistente, e nada é gravado.
- A matriz põe `nunca` para a coordenação e para a rede.
- Os itens do dia vêm de turma e disciplina dos vínculos da professora e não trazem dado de aluno.
- A falha está fora das rotas novas: é o arquivo do titular (bloqueante 1).

**Logs:** limpos no desenho. Só ids e data, nunca o texto (seção 7). No endereço vão só ids e datas (`?aula=<vinculoId>.<data>.<HHMM>`, `?turma=`, `?semana=`), conforme a seção 9.

**Auditoria:** não se aplica, e a justificativa da seção 11 se sustenta. O texto é dado da própria professora, sem aluno, nota ou permissão, e nenhum outro papel o lê. A rota de leitura não é da coordenação nem da rede, e o arquivo do titular já é auditado (`titular.arquivo_baixado`). A ressalva é que, se o texto entrar na troca de nome (bloqueante 2), a troca precisa gravar `titular.nome_trocado` como as outras tabelas fazem.

**Envio externo:** nenhum. A seção 8 diz "não se aplica", e "Preparar esta aula" leva só a turma no `CONTEXTO_ESCOLHIDO`, sem o texto e sem criar conversa (seção 9). Por isso o registro em `ExecucaoAgente` e o provedor local não se aplicam.

**Seed/fixture:** a spec não menciona. Nada indica dado real.

**Bloqueantes:**

1. **Tech Spec, seções 2 e 7, linha "DTO de saída" ("o registro entra no arquivo do titular"): falta dizer em qual versão do arquivo o texto entra.**
   - **O problema:** o arquivo tem duas versões. A `coordenacao`, a do titular sem conta ativa, é baixada pela coordenação (`apps/api/src/privacidade/privacidade.service.ts:352`). A regra de que essa versão não leva o texto do professor está em `packages/core/src/titular/leitura-do-titular.ts:29`: ela já deixa de fora a conversa com o Assistente, a `entrada` da execução e a `justificativa` da entrega (regra 70, item 8).
   - **Por que bloqueia:** se a entrada `aula` for escrita como as outras, sem restrição de versão, entra nas duas. A coordenação passa a ler o planejamento da professora que saiu, o que contradiz o RF11 ("nenhuma rota da coordenação devolve o texto").
   - **Correção exigida:**
     - A entrada `aula` em `LEITURAS_DO_ARQUIVO` leva `conteudo` só na versão `completa`. Pode ser `porVersao` ou `naVersao: completa`, com `colunas` e `fora` declarados.
     - A tabela ganha a classificação em `packages/shared/src/privacidade/classificacao.ts`: categoria `vinculo_encerrado`, ligação `vinculo_id`. Esse arquivo precisa entrar na lista de módulos da seção 2.
     - O teste "coordenação sem acesso" da seção 10 cobre também o arquivo do titular na versão `coordenacao`, com um texto marcado (sentinela) que não pode aparecer.

2. **Tech Spec, seções 3 e 7, linha "Retenção e expurgo": o texto não entra na troca de nome feita na eliminação do aluno.**
   - **O problema:** quando um aluno é eliminado, o F3 troca o nome dele por `[nome removido]` em todo texto livre de professor que fica guardado. A lista está em `COLUNAS_DA_TROCA_DE_NOME`, em `packages/core/src/titular/troca-de-nome.ts:44-52`, e inclui `entrega.justificativa`, também de 500 caracteres. O único texto de professor fora dela é o complemento da contestação, e só porque sai na virada do ano.
   - **Por que bloqueia:**
     - O próprio PRD prevê nome de aluno nesse texto, tanto que pede um aviso (RF5 e caso de borda). Um texto como "revisar a lista 3 com o Pedro" é o uso normal.
     - O texto fica guardado até 60 meses depois do fim do vínculo, e a seção 7 só diz "cascata com o vínculo".
     - Com isso, a eliminação do aluno deixa o nome dele gravado, contra a regra 20, item 15 ("apaga de fato"), e a pergunta de fechamento falha nessa coluna.
   - **Correção exigida, uma de duas:**
     - (a) Pôr `{ tabela: 'aula', coluna: 'conteudo', tipo: 'text', anulavel: false, limite: 500 }` em `COLUNAS_DA_TROCA_DE_NOME`. Isso pede também:
       - um índice `(escola_id, id)` para percorrer a tabela em faixas;
       - `aula` em `TABELAS_AUDITADAS_NA_TROCA_DE_NOME`;
       - corte no limite, porque o check `between 1 and 500` derrubaria a faixa;
       - um teste de integração: texto com o nome do aluno, eliminação, texto com `[nome removido]`.
     - (b) Encurtar a retenção para que o texto saia no encerramento do vínculo ou na virada do ano, como o complemento da contestação, e registrar essa exclusão no comentário da lista e na linha do `docs/lgpd.md`.

**Recomendações (não bloqueiam):**
- **Retenção.** Mesmo com a opção (a), vale rever o prazo. Depois do fim do vínculo, ninguém mais lê o texto, nem a própria professora (caso de borda do PRD). Guardar mais 12 a 60 meses um texto sem finalidade viva vai contra a minimização.
- **Rascunho.** A seção 9 diz "store de aba, como o da contestação". O da contestação é estado em memória (`useState` em `apps/web/src/areas/professor/turmas/Turmas.tsx:60`). Convém escrever que o rascunho fica em memória, nunca em `sessionStorage` ou `localStorage` (o Chromebook é compartilhado), e que é descartado na troca de escola e na saída da sessão (RF9).
- **F11.** O PRD dá a finalidade futura "na F11, o seu dia e sua semana". A linha do `docs/lgpd.md` deveria dizer que o texto não vai a provedor de IA na F2b, e que a F11 reabre a linha (envio externo, `ExecucaoAgente`, D62).
- **Demonstração.** Se o seed do MVP ganhar textos de aula, que sejam sintéticos e sem nome de pessoa.
- **Itens do dia de colega.** A professora vê, pelo título e pelo estado, os itens de um colega com vínculo na mesma turma e disciplina, como um substituto vê os do antecessor. É coerente com a leitura da turma que já existe, mas vale um teste dizendo que o item não traz dado de aluno nem autor.

Arquivos lidos para a auditoria:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/titular/leitura-do-titular.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/titular/troca-de-nome.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/shared/src/privacidade/classificacao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/docs/lgpd.md` (linha 74, "Aula da grade")

```
VEREDITO: REPROVADO
Campos pessoais tocados: aula.conteudo (novo, professor, até 500 caracteres de texto livre); derivados: alocacao, vínculo, nomes de turma e disciplina, sala, título do artefato e estado da entrega
Fora da tabela de dados do docs/lgpd.md: aula.conteudo (entra na tarefa da tabela, como manda a regra; a linha precisa dizer que o texto pode ter nome de aluno, que não vai a IA, e como sai na eliminação)
Autorização por objeto: ok nas rotas novas (seções 5 e 6); falha no arquivo do titular, versão coordenacao (bloqueante 1)
Logs: limpos (só ids e data; o endereço só com ids e datas)
Auditoria: não se aplica, justificado na seção 11 (dado da própria professora); a troca de nome, se entrar, grava titular.nome_trocado
Envio externo: nenhum; "Preparar esta aula" leva só a turma, sem o texto; nada a registrar em ExecucaoAgente
Seed/fixture: não mencionado (sem indício de dado real)
Bloqueantes: (1) seções 2 e 7 da Tech Spec: a entrada `aula` do arquivo do titular não diz a versão; a versão coordenacao entregaria o texto à coordenação, contra o RF11 e a regra 70, item 8. Correção: conteudo só na versão completa, classificação da tabela em classificacao.ts e teste com texto marcado na versão coordenacao. (2) seções 3 e 7 da Tech Spec: aula.conteudo fora de COLUNAS_DA_TROCA_DE_NOME, com retenção de até 60 meses após o fim do vínculo; a eliminação do aluno deixaria o nome dele gravado (regra 20, item 15). Correção: entrar na troca de nome (com índice, auditoria, corte em 500 e teste) ou apagar no encerramento do vínculo ou na virada do ano, registrando a exclusão
Recomendações: rever a retenção depois do fim do vínculo; rascunho só em memória, descartado na troca de escola e de sessão; a linha do lgpd.md diz "sem IA na F2b" e que a F11 reabre; seed de demonstração sintético; teste de que o item do colega na mesma turma e disciplina não traz aluno nem autor
```

## test-engineer · 1ª rodada · REPROVADO · 2026-11-06 13:21:16 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: aulas de três turmas no dia e na hora da grade, escrever, salvar e reabrir o texto, navegar entre semanas.
- Bordas da seção 7 do PRD: feriado no dia da prova, duas disciplinas na mesma turma, aula dupla, professor que saiu em março, substituto, turma sem professor, virada do ano, texto com nome de aluno.
- Bordas do desenho: recesso que começa antes da segunda, "hoje" perto da meia-noite no fuso da escola, PUT numa data que não tem aula, registro fora da grade que ocupa o início novo, job executado duas vezes.
- Permissão: coordenação e rede sem o texto e sem contagem, nem pelo arquivo do titular.
- Isolamento: outra escola, colega da mesma escola, outro ano e id inexistente dão a mesma resposta e nada é gravado. Professora de duas escolas.
- Concorrência: duas gravações em paralelo, gravação contra o job da grade.
- Escola sem ano letivo em curso nas duas rotas. Um vínculo encerrado e outro aberto.

**Cobertos (seções 6, 7c e 10):**
- RF1: só vínculo confirmado, na integração.
- RF3 e RF13: em parte, na unidade "montagem dos dias" e no feriado que tira e devolve o texto.
- RF4: o link do Hoje.
- RF5: salvar e reabrir.
- RF6: o selo, na unidade.
- RF7: itens por turma e disciplina.
- RF9: a troca de escola.
- RF10: outra escola, colega e inexistente.
- RF14: os quatro casos, com o job real.
- RF15: as duas corridas declaradas em paralelo.
- Pareamento da aula dupla, na unidade. Arquivo do titular. Coordenação sem acesso. Professora de duas escolas. Passo da grade da escola A sem tocar a escola B.
- Não há IA: nenhum provedor pago e nenhum mock que esconda a regra.

**Bloqueantes:**

1. **Escola sem ano letivo em curso** (seções 5 e 10). Nenhuma das duas rotas tem esse cenário.
   - Hoje o `requireAnoEmCurso` lança `NAO_ENCONTRADO`. Em janeiro, entre um ano e outro, a Semana cairia no estado "erro, Tentar de novo", que o RF12 não prevê.
   - Exigido: integração de `GET /v1/semana` e `PUT /v1/aulas` numa escola só com ano `planejado` ou `encerrado`, com a resposta definida e nada gravado.
   - Exigido também: o estado da tela definido na seção 9 e no RF12, com o teste dele.

2. **Um vínculo encerrado e outro aberto, e o substituto** (seções 6 e 10; PRD, seção 7).
   - Problema: a seção 6 cita "encerrado" e "de outro ano" na lista da mesma resposta, mas o item "Testes" só prova outra escola, colega e inexistente.
   - Problema: o passo (4) da leitura, "os registros dela na semana", não diz que se limita aos vínculos confirmados. Se não se limitar, o registro passado do vínculo encerrado volta na Semana como `foraDaGrade`.
   - Exigido, cenário na integração: o antecessor, com vínculo encerrado, escreveu o texto de uma aula. O substituto tem vínculo confirmado na mesma turma, disciplina, dia e início.
     - O `GET` do substituto não traz o texto do antecessor.
     - O `GET` do antecessor não traz a aula nem o registro fora da grade.
     - O `PUT` do antecessor dá `NAO_ENCONTRADO` e não grava.
   - Exigido também: o mesmo cenário produzido pela reimportação real da grade, que encerra um vínculo por realocação e cria o do substituto.

3. **RF10 "de outro ano" e a virada do ano** (seção 10; PRD, seção 7).
   - Exigido: `PUT` com um vínculo do ano anterior dá a mesma resposta e não grava.
   - Exigido: com o ano novo em curso, o `GET` não traz o registro do ano anterior.
   - Exigido: a semana que atravessa o fim do ano mostra só os dias dele, provado na integração, e não só na unidade.

4. **As cláusulas do "Gravar" não têm teste** (seção 5, "Gravar"). São elas que impedem a professora de inventar aula (regra 60, item 8). Exigido, um caso de integração para cada uma, que deve dar `NAO_ENCONTRADO` e não gravar:
   - data em feriado ou em recesso;
   - data fora do período do ano;
   - início que não é de nenhuma alocação;
   - dia da semana sem alocação daquele vínculo;
   - data futura sem alocação.

   E mais dois:
   - o registro passado fora da grade se corrige, e esse ramo é permitido;
   - o texto vazio apaga a linha.

5. **Corrida da gravação contra o job da grade** (seção 7c, item 2).
   - Problema: duas chamadas soltas num `Promise.all` não garantem a ordem que importa. Sem o `for key share`, o teste fica verde quando o `PUT` cai fora da janela, então ele não falha se a trava for removida.
   - Exigido: forçar a ordem. O job apaga a alocação e passa pelo passo de apagar os registros, mas ainda não confirma a transação. Nesse momento vem o `PUT`, e depois o job confirma.
   - Exigido: provar o fim sem registro futuro sem alocação. Vale também para o re-chaveamento: `PUT` no início velho durante o par.

6. **RF14, cláusula "um registro fora da grade que já ocupe o início novo sai antes"** (seção 5). Ela apaga texto passado da professora e nenhum dos quatro casos chega a ela. Exige um caso próprio na integração.

7. **"Hoje" no fuso da escola** (seção 5 e seção 13, "Hoje na meia-noite"). Exigido, um teste com relógio falso entre 21h e 24h de Brasília, quando em UTC já é o dia seguinte, provando:
   - o `hoje` e o `agora` do `GET`;
   - o selo "Falta preencher" da aula de hoje;
   - o "apaga data ≥ hoje" do job, com o registro de hoje.

8. **RF3, recesso de duas semanas** (seção 10).
   - Problema: só a unidade cobre. O erro provável está no SQL do passo (3), "eventos que cruzam a semana": um filtro pelo início do evento perde o recesso que começou na semana anterior.
   - Exigido: integração com um recesso que começa antes da segunda e acaba depois da sexta, esvaziando as duas semanas.
   - Exigido: um evento como "Conselho de classe" que não tira a aula.

9. **Bordas do PRD sem teste previsto** (seção 10):
   - **Feriado no dia da prova:** a aula sai, e o item da atividade aplicada naquele dia continua nele.
   - **Duas disciplinas na mesma turma:** o texto de uma não aparece na outra, e o filtro separa. O cenário do colega de outra disciplina, que está na seção 6, é outro caso.
   - **Turma sem professor alocado:** não aparece na Semana de ninguém.
   - **Texto com nome de aluno:** o aviso no e2e, e o `PUT` sem linha de auditoria nem log com o conteúdo, provado capturando o logger.

[… 30 linhas cortadas]

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 13:25:20 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: APROVADO

O único bloqueante da rodada 1 foi resolvido: o texto da aula não chega mais à coordenação pelo arquivo do titular. As quatro correções exigidas estão na Tech Spec e no `cenarios.md`.

**As quatro correções**

1. **A `aula` só entra na versão `completa` (critério 5).** A seção 2 manda pôr a `aula` só na `completa`, filtrada por `naVersao`, e a classifica em `classificacao.ts`. A linha "DTO de saída" da seção 7 confirma que a versão `coordenacao` não traz a tabela. O código atual comporta isso:
   - `naVersao` é verificado na montagem do arquivo (`packages/core/src/titular/leitura-do-titular.ts:460`), e o resumo só conta as tabelas incluídas. Então a versão `coordenacao` não mostra nem o número de aulas.
   - A coordenação só alcança a versão `coordenacao` (`apps/api/src/privacidade/privacidade.service.ts:344-353`). A `completa` sai só por "Meus dados", para a própria professora.
2. **Nenhuma contagem na prévia.** A seção 7 diz que nenhuma contagem da prévia soma a `aula`. Hoje a prévia do professor já mostra só as categorias de cadastro e vínculo (`apps/api/src/privacidade/titulares.repository.ts:198`, D64). O cenário R5 prova isso, e o J9 tira contagem e menção de registro de aula do resumo, da prévia e da auditoria da reimportação.
3. **Testes de unidade e integração.**
   - R5, integração: um texto-sentinela fica fora da versão `coordenacao`, aparece na `completa`, e a prévia não traz contagem de aulas.
   - R6, unidade: `naVersao` da `aula` dá `completa` sim e `coordenacao` não; na `matriz.test.ts`, a `aula` é `nunca` para coordenação, rede e aluno.
4. **A rota citada na seção 6.** `/v1/privacidade/pedidos/:id/arquivo` aparece como a única rota indireta da coordenação, e o texto diz que ela não leva a `aula`.

A seção 7b agora tem uma linha por item: item 8 (o texto não chega à coordenação, nem pelo arquivo do titular), item 9 e D64 ("Falta preencher" é selo por aula, sem total, provado pelo cenário T11) e item 7 (itens sem nome de aluno, provado pelo S9). No resto do que mudou, nada novo afeta a regra 70. "Preparar esta aula" não cria conversa (seção 9, T4), o log e a auditoria não levam o texto (G5), e não há IA nem nota.

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum (a spec não grava Nota; a tabela `aula` só guarda o texto de planejamento da professora) — todos com autor humano? sim (não há caminho)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (sem saída de IA na F2b, seção 8 "Não se aplica"; "Preparar esta aula" só leva ao Início, sem criar conversa)
Supervisão do tutor: ok (o Tutor não é tocado)
Autonomia declarada e visível: sim (nenhum agente novo nem nível de autonomia alterado)
Bloqueantes: nenhum. O da rodada 1 (a `aula` no arquivo do titular da versão `coordenacao`) foi resolvido nas seções 2, 6, 7 e 7b e nos cenários R5, R6, J9 e T11.
Recomendações:
- packages/core/src/titular/leitura-do-titular.ts:29-33: na tarefa, acrescentar a `aula` à lista do critério 5 no comentário do cabeçalho, para a próxima tabela de texto do professor seguir o mesmo caminho.
- cenarios.md R5: também verificar que o resumo da versão `coordenacao` não tem linha com a descrição da `aula`, além de a tabela não aparecer.
- Seção 7b: dizer que a entrada nova em `classificacao.ts` não cria categoria na prévia do professor, para que nenhuma tarefa posterior acrescente "Registro de aulas" a `categoriasDoProfessor` (D64).
```

## tenancy-guardian · 2ª rodada · REPROVADO · 2026-11-06 13:25:20 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO

Os dois bloqueantes da rodada 1 estão resolvidos. O desenho novo traz um bloqueante: a trava do vínculo é tomada antes de conferir se o vínculo é da professora.

Tabelas verificadas: `aula` (Tech Spec §3). Tem `escolaId` e `anoLetivoId`, id em uuid v7, e FK composta (escolaId, anoLetivoId, vinculoId) para `vinculo`. Também a `aula` em `classificacao.ts` e na leitura do titular, com `naVersao` só `completa` (§2).

Queries verificadas:
- **Leitura (§5):** os registros só dos vínculos confirmados, e os eventos que cruzam a semana.
- **Gravação (§5):** confere o vínculo pela escola, ano, usuário da sessão e `confirmado`, mais o `setWhere` da escola do contexto.
- **Passo da grade (§5 e §6):** recebe só o ano de destino; com ano `planejado`, não faz nada.
- **`virarAno` (§2 e §3):** o `vinculo.repository.ts:345-358` existente já filtra por `requireEscolaId()` e pelo ano; o `delete` novo da `aula` segue o mesmo filtro.
- **Arquivo do titular, versão `coordenacao` (§6 e §7):** não traz a `aula`, e a prévia não a conta.

Teste de isolamento: presente e efetivo.
- **Bloqueante 1 da rodada 1 (texto na versão `coordenacao`):** corrigido em §2, §6, §7 e §7b. R5 (texto sentinela na versão `coordenacao`) e R6 (`naVersao` e matriz) quebram se `naVersao` incluir `coordenacao`.
- **Bloqueante 2 da rodada 1 (eventos sem teste):** corrigido no R3. Sem o filtro de escola nos eventos, o feriado da escola B tiraria as aulas da A naquele dia e mostraria tipo e descrição de B, e o teste quebra.
- **Recomendações da rodada 1:** todas feitas. PUT com vínculo de outro ano: G4. `setWhere`: §5. Ano de destino no passo da grade: §5. Rascunho descartado na troca de escola: §7, §9 e T7.

Bloqueantes:
1. **Tech Spec §5, "Gravar", e §7c, "Corridas":** o `PUT` toma `pg_advisory_xact_lock` com a chave tirada só do `vinculoId` do corpo, **antes** de conferir que o vínculo é da professora, da escola do token, do ano e `confirmado`.
   - **O que vaza:** com o `vinculoId` de outra escola ou de um colega, enquanto a reimportação da grade daquela escola segura a trava, o `PUT` espera 2 s e responde `INDISPONIVEL_TENTE_DE_NOVO`. Para um id inexistente, responde `NAO_ENCONTRADO` na hora. São respostas diferentes para "não existe" e "não é seu", o que confirma que o id existe (regra 10, item 6; RF10).
   - **Interferência:** além disso, um id mandado pelo cliente segura uma trava que o job de outra escola espera.
   - **Correção exigida:** conferir o vínculo antes de tomar a trava (dela, escola e ano do contexto, `confirmado`). Só depois tomar a trava e verificar a alocação ou o registro. A chave segue o padrão da casa, como em `tutor.repository.ts:231`: prefixo da trava, mais a `escolaId` do contexto, mais o `vinculoId`. Acrescentar no R1 (ou num J novo) o caso de vínculo de outra escola com a trava presa por outra transação: o `PUT` responde `NAO_ENCONTRADO`, sem esperar o `lock_timeout`, e não grava.

Recomendações:
- S7: incluir uma linha de `aula` da escola B no mesmo cenário e provar que ela continua depois do `virarAno` da escola A.
- §5: dizer de forma explícita que a chave da trava do passo da grade usa a `escolaId` do contexto do job, a mesma composição da gravação. Assim as duas se encontram, e nenhuma esbarra na de outra escola.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/estrutura/vinculo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/api/src/tutor/tutor.repository.ts

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-06 13:25:46 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: APROVADO

Os dois bloqueantes da rodada 1 foram corrigidos na Tech Spec e cada um tem cenário que o prova.

**Bloqueante 1: a professora sem conta ativa tinha o texto da aula no arquivo do titular da versão `coordenacao`. Corrigido.**
- §2 e §7 da Tech Spec: a tabela `aula` só entra na versão `completa` do arquivo, pelo filtro `naVersao` que já existe (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/titular/leitura-do-titular.ts:460`, o mesmo usado por `thread_agente` e `mensagem_agente`). Sai da versão a tabela inteira, não só a coluna, e a prévia não ganha contagem. Conferi que a prévia do professor não conta registros (`privacidade.service.ts:203`), então a frase "nenhuma contagem da prévia a soma" já vale hoje e R5 a prende.
- §6 nomeia `/v1/privacidade/pedidos/:id/arquivo` como a única rota indireta da coordenação e diz que ela não traz a `aula`. §7b liga isso aos itens 8 e 9 da regra 70.
- Provas: **R5** gera o arquivo nas duas versões com um texto marcado (sentinela); **R6** testa o `naVersao` e as células `nunca` da matriz de permissão.

**Bloqueante 2: `aula.conteudo` ficava fora da troca de nome e era guardado 60 meses. Corrigido pela opção (b).**
- §3 e §7: o texto sai no `virarAno`, na transação que encerra o ano. Antes disso, sai em cascata com o vínculo.
- Os dois caminhos de saída existem no código:
  - **Eliminação da professora:** `apagarVinculos` (`ciclo-de-vida.repository.ts:358`) apaga os vínculos, e o `on delete cascade` da FK composta leva as linhas de `aula`.
  - **Virada do ano:** `virarAno` (`vinculo.repository.ts:345`) já apaga o `complemento` da contestação, que é o precedente citado.
- §11 registra o desvio do item 15 da regra 20. O motivo fica no comentário de `troca-de-nome.ts`, que já deixa a contestação de fora pelo mesmo argumento. O PRD §8 trocou a retenção para "até a virada do ano letivo".
- Prova: **S7** confere, com o ano novo em curso, que o `virarAno` apagou as linhas e que o `GET` não traz o registro do ano anterior.

**O que você corrigiu além dos bloqueantes:**
- **Rascunho na web** (§7, §9): fica só em memória, nunca em `localStorage` nem `sessionStorage`, e é descartado na troca de escola e na saída. **T7** prova a troca de escola.
- **IA:** §7 diz que o texto não vai a IA na F2b e que a F11 reabre a linha. "Preparar esta aula" guarda só a turma em `CONTEXTO_ESCOLHIDO`, sem levar o texto.
- **Log e auditoria:** **G5** prova que o log do `PUT` não traz o texto e que nenhuma linha de auditoria nasce da gravação.

Campos pessoais tocados: `aula.conteudo`, texto da professora com até 500 caracteres, que pode trazer nome de aluno. O DTO não tem campo de aluno.
Fora da tabela de dados do docs/lgpd.md: a linha de `aula.conteudo` entra na tarefa da tabela, como §2 e §7 exigem. Finalidade e retenção já estão no PRD §8 e na Tech Spec §7.
Autorização por objeto: ok. O vínculo é buscado com escola, ano em curso, usuário da sessão e estado `confirmado`, mais a FK composta e o `setWhere` (§6). Trocar o id dá `NAO_ENCONTRADO` igual ao inexistente (R1, R4, G4).
Logs: limpos. Só ids e data (§7, G5).
Auditoria: presente onde a regra exige. A gravação não é auditada porque é dado da própria professora; o desvio está registrado em §11.
Envio externo: nenhum. O texto não vai a IA na F2b.
Seed/fixture: sintético. A spec não cria seed; os cenários usam texto sentinela.
Bloqueantes: nenhum.
Recomendações:
- `classificacao.ts`: não existe chave de prazo fixo para "até a virada do ano" que sirva à `aula`; a `lista_de_nomes` tem esse prazo com outra descrição. §2 da Tech Spec pode nomear a chave nova de `CHAVES_DE_PRAZO_FIXO`, com a descrição para o titular, e a ligação `vinculo_id`.
- `leitura-do-titular.ts:31`: o comentário do critério 5 lista o que a versão `coordenacao` não traz. Incluir ali o registro da aula.
- **S7:** incluir uma linha de `aula` de vínculo encerrado antes do fim do ano (por desligamento ou realocação, o caso do R4) e conferir que o `virarAno` também a apaga, como o teste do `complemento` faz.
- **T7:** cobrir também a saída (logout), não só a troca de escola. A §7 promete as duas.
- Se o `virarAno` passar a devolver a contagem de linhas de `aula` apagadas para a auditoria, que seja só o número, sem nada por professora.

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-06 13:27:22 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: nenhum (o passo novo roda no job da grade do F2 e na fila que já existe)
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida entre a gravação e o `virarAno` (Tech Spec §5 "Gravar" e §7c; falta cenário no `cenarios.md`)
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**O bloqueante da rodada 1 está resolvido.** Uma trava só por vínculo, tomada pela gravação antes de qualquer leitura e pelo passo da grade antes de ler ou escrever em `aula`, em ordem de id, com `lock_timeout` de 2 s, fecha as corridas 2 e 3 (J11, J12, J13). A colisão no início novo deixou de apagar texto passado (§5, J4).

**Riscos da trava nova, conferidos no código:**
- **Deadlock com o job: não há.** Antes da trava nova, o passo 3 do job (`packages/core/src/importacao/motor.ts:169`) trava a importação, o ano (`for share`), a trava do convite, os usuários, as contas e as turmas. A gravação toma a trava do vínculo e depois só faz leituras simples. Na inserção em `aula`, a FK pega `KEY SHARE` no vínculo e no ano, e isso não conflita com o `NO KEY UPDATE` do encerramento por realocação nem com o `FOR SHARE` do ano. Assim, a gravação só espera o job na trava do vínculo, e não há ciclo.
- **Conexão presa: limitada.** O job toma as travas de vínculo no fim do passo 3 e as segura só até o commit. Do lado do job, a espera é limitada pelo `lock_timeout` de 1 s que ele já usa (`importacao.repository.ts:236`); trava esgotada vira nova tentativa (D49). Do lado da API, cada gravação segura uma conexão por no máximo 2 s.
- **Ordem de leitura: correta.** As transações rodam em READ COMMITTED (não há `isolationLevel` no código), então ler depois da trava enxerga o commit do job.

**Bloqueantes:**

1. **A gravação não trava o ano em curso.** (Tech Spec §5 "Gravar", §7c "Corridas", §3 "Sai na virada do ano"; `apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts:56` e `packages/core/src/estrutura/vinculo.repository.ts:345`)
   - **O que acontece:** o `virarAno` não toma a trava do vínculo, e a gravação não segura nada que o `update` de encerramento espere. O `update` do vínculo para `encerrado` pega `NO KEY UPDATE`, que é compatível com o `KEY SHARE` da FK. Por isso uma gravação pode ler o ano em curso e o vínculo confirmado, e só fazer o commit depois que o `delete from aula` do `virarAno` já passou. A linha fica num ano encerrado e só sai na cascata do expurgo do vínculo, anos depois.
   - **Por que importa:** é exatamente o texto com nome de aluno eliminado que a correção de privacidade da rodada 1 mandou tirar na virada. É o padrão "busca, verifica, grava" (regra 80, item 7).
   - **Correção exigida:**
     - A gravação chama `TurmaRepository.travarAnoEmCurso()` (`for share`, `packages/core/src/estrutura/turma.repository.ts:57`), o padrão da casa descrito em `ano-letivo.service.ts`. Ano já fora de curso responde `NAO_ENCONTRADO`.
     - A chamada vem antes da trava do vínculo, na mesma ordem global do job (ano antes do resto), e fica sob o mesmo `lock_timeout`.
     - Novo cenário [P] no `cenarios.md`: o encerramento do ano segura o ano, o `PUT` espera, o ano encerra, e o `PUT` responde `NAO_ENCONTRADO` sem deixar nenhuma linha em `aula` do ano encerrado. O teste fica vermelho sem a trava.
   - **Efeito colateral:** com isso, o "encerramento concorrente do vínculo aceito" do §7c passa a ser coberto também no caso da virada.

2. **O J11 força só uma ordem, e não a mais arriscada.** (`cenarios.md` J11)
   - **O que acontece:** no código real, o job apaga a alocação em `gravarAulas` (`packages/core/src/importacao/tipos/grade.ts:512-513`) antes de tomar a trava do vínculo. A ordem que precisa de prova é esta: o job apagou a alocação sem fazer commit; a gravação toma a trava, ainda enxerga a alocação velha e grava; o job espera a trava e, depois dela, precisa ler `aula` de novo e apagar o registro futuro.
   - **Por que importa:** uma implementação que calcule os registros do passo antes de tomar a trava passa no J11 atual e deixa um registro futuro sem alocação.
   - **Correção exigida:** o J11 (ou um J11b) cobre também essa ordem, com a trava do vínculo segurada por uma conexão de teste, no molde de `apps/api/test/escola-lock.ts`. No fim, nenhum registro futuro fica sem alocação.

**Recomendações:**
- **§5:** usar a forma de duas chaves, `pg_advisory_xact_lock(<classe>, hashtext(vinculoId))`, com uma constante de classe própria, como `CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA` (`packages/core/src/convite/convite-da-escola.repository.ts:78`). Isso separa o espaço de chaves das outras travas e deixa o teste achar a espera por `classid`/`objid`.
- **§5:** no job, travar só os vínculos que já existiam antes do passo (os criados na própria transação ainda não têm registro), num comando só, com subconsulta ordenada por id. Uma primeira grade completa não deve fazer centenas de idas e voltas dentro do passo 3 curto.
- **§4:** na API, mapear `55P03` (trava esgotada) para `INDISPONIVEL_TENTE_DE_NOVO` e não deixar o erro subir cru. O J13 deve conferir o código, não só o tempo.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/estrutura/vinculo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/estrutura/turma.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/tipos/grade.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/motor.ts

```
VEREDITO: REPROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida em techspec.md §5 "Gravar" contra ano-letivo.service.ts:56 (virarAno)
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: (1) techspec §5/§7c — a gravação não trava o ano em curso; virarAno pode apagar as aulas antes do commit dela e o texto sobra no ano encerrado; exigir travarAnoEmCurso() (for share) antes da trava do vínculo, com NAO_ENCONTRADO, e um cenário [P] com a virada. (2) cenarios.md J11 — cobrir também a ordem em que o job já apagou a alocação e espera a trava que a gravação segura; nenhum registro futuro fica sem alocação.
Recomendações: trava de duas chaves com classe própria (§5); no job, travar só os vínculos que já existiam, num comando ordenado (§5); 55P03 vira INDISPONIVEL_TENTE_DE_NOVO, conferido no J13 (§4)
```

## test-engineer · 2ª rodada · REPROVADO · 2026-11-06 13:27:38 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** ler a semana só dos vínculos confirmados e do ano em curso; feriado, recesso e evento, inclusive o que atravessa a semana; a virada do ano e a escola sem ano em curso; "hoje" e "agora" no fuso de Brasília; os itens do dia (RF7) sem nota nem nome de aluno; cada cláusula do "Gravar"; texto vazio e o limite de 500; isolamento na leitura, na gravação, nos eventos e no passo da grade; vínculo encerrado e substituto; o arquivo do titular nas duas versões; os quatro casos do RF14 e a colisão; as corridas (gravação contra gravação, contra a saída da aula, contra o re-chaveamento e contra a virada); `lock_timeout`; as bordas do PRD §7; o "Como se prova" de cada RF no e2e.

**Os 11 bloqueantes da rodada 1:**
1. Sem ano em curso: resolvido (§4; S6, T8).
2. Vínculo encerrado e substituto: resolvido (S1, S8, R4).
3. Outro ano e virada: resolvido (G4, S5, S7).
4. Cláusulas do "Gravar": quase todas cobertas (G1 a G4, R1, R4). Falta o qualificador "passado" do segundo ramo (bloqueante 1 abaixo).
5. Corrida com ordem forçada: resolvido (G6, J11, J12, J13).
6. Colisão do RF14: resolvido. O desenho novo não apaga texto passado (§5), e J4 cobre.
7. "Hoje" no fuso: resolvido (S13, J8).
8. Recesso que atravessa a semana: resolvido (S4, que testa as duas pontas do cruzamento).
9. Bordas do PRD: quase todas cobertas (S10, S11, S12, S1/R4, S5/S7, G5/T2). Falta a aula dupla na leitura (bloqueante 2 abaixo).
10. "Como se prova" no e2e: resolvido (T1 a T10).
11. RF11 contra o arquivo do titular: resolvido (R5, R6; §7).

**Desenho novo:**
- A trava por vínculo está coberta por J11, J12 e J13.
- `ano: null` está coberto por S6 e T8.
- `virarAno` apagando as linhas de `aula` está coberto por S7.
- A `aula` só na versão `completa` está coberta por R5 e R6.

**Bloqueantes:**

1. **`techspec.md` §5 "Gravar", `cenarios.md` G1: o "passado" do segundo ramo não tem cenário.**
   - A aula vale pela alocação num dia sem feriado nem recesso, **ou** por "um registro passado já gravado".
   - G1 testa "data futura sem alocação" sem registro prévio, então nunca chega ao "passado". Se o "passado" sair do código, G1 continua verde.
   - O caso é alcançável pelo próprio J10: texto gravado numa aula futura, depois a reimportação do calendário põe feriado nesse dia.
   - Correção: incluir em G1 um `PUT` em data futura com registro já gravado e sem aula válida (feriado novo sobre o texto). O esperado é `NAO_ENCONTRADO`, com o texto e o `atualizadoEm` intactos.

2. **`prd.md` §7 "Aula dupla" sem cenário na leitura e na gravação, `cenarios.md` S2/S11.**
   - J5 só prova o pareamento na reimportação, e pode afirmar direto no banco.
   - S11 é sobre vínculos diferentes (duas disciplinas).
   - Se a leitura casar o registro por (vínculo, data) sem o `inicio`, as duas aulas do dia mostram o mesmo texto, e nenhum cenário fica vermelho.
   - Correção: um cenário [I] com duas alocações seguidas do mesmo vínculo no dia. O `GET` traz cada aula com o próprio texto, e o `PUT` numa não altera a outra.

3. **`techspec.md` §5 "Gravar", §3 e §7c: a gravação não se ordena com a virada, e não há cenário de concorrência.**
   - O `virarAno` apaga a `aula` do ano na transação do encerramento, mas a gravação só toma a trava do vínculo, que o `virarAno` não toma.
   - O que acontece, com leitura confirmada (read committed):
     - O `PUT` lê o vínculo `confirmado` e o ano em curso antes do commit da virada.
     - A FK composta toma `FOR KEY SHARE`, que não espera o `update` de estado do vínculo.
     - O `insert` entra depois do `delete` da virada.
   - Resultado: a linha fica no ano encerrado e só sai com o expurgo do vínculo, anos depois. Isso é justamente o que a correção de privacidade da rodada 1 (texto fora em 60 meses) quis evitar.
   - O "aceito, sai na virada" de §7c vale para o encerramento avulso do vínculo, não para a própria virada.
   - Correção, nas duas partes:
     - No desenho: a gravação se ordena com a virada, ou com `FOR SHARE` no `ano_letivo`, como `travarAnosDosVinculos` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:65`, ou com o `virarAno` tomando a trava dos vínculos.
     - Nos cenários: um [P] com ordem forçada. A virada para depois de apagar a `aula` e antes do commit, e o `PUT` corre nesse intervalo. No fim, nenhuma linha de `aula` do ano encerrado, e o `PUT` responde `NAO_ENCONTRADO`. Sem a trava, o cenário fica vermelho.

**Recomendações:**
- **J11:** nomear o ponto da pausa: depois de o passo apagar os registros de data maior ou igual a hoje, e antes do commit. A §5 toma a trava depois do `gravarAulas`. Pausado antes do passo, o teste fica verde sem a trava.
- **J12:** escrever "tirada a trava, o teste fica vermelho", como em J11. O motivo é o registro duplicado pelo `on conflict` na chave velha.
- **R1:** incluir o `PUT` com vínculo `pendente` e com vínculo `contestado`, que a §6 lista. Hoje só o encerrado (R4) prova a cláusula `confirmado` na gravação.
- **RF11:** um cenário [I] com token de coordenação e de aluno direto em `GET /v1/semana` e `PUT /v1/aulas`.
- **§5 "Ler" e "Gravar":** decidir se o registro passado num dia que virou feriado é gravável. Hoje ele fica escondido na leitura e gravável no `PUT`.
- **§5 "Reimportar":** a frase "Ano `planejado`: o passo não faz nada" não é observável, porque não há texto nesse ano. Mais útil é um cenário em que a grade do ano planejado é reimportada e o texto do ano em curso fica intacto.
- **S7:** a escola B fica intacta na virada da escola A. É um custo baixo, ainda que o id do ano já isole na prática.
- **T7 e T8:**
  - Afirmar que o rascunho não está em `localStorage` nem em `sessionStorage`, e que sai na saída da conta, num computador de escola compartilhado (§7).
  - O estado "carregando" do RF12 não está em T8.
- **Preenchimento da tabela:** no momento da leitura, a tabela "Revisões" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/revisao-spec.md` já trazia a rodada 2 do `tenancy-guardian` como REPROVADO. Vale juntar os bloqueantes dele aos meus antes da rodada 3.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/prd.md`

```
VEREDITO: REPROVADO
Cenários exigidos: leitura por vínculo confirmado e ano em curso; feriado, recesso e evento que cruzam a semana; virada e escola sem ano; fuso; itens RF7; cada cláusula do Gravar; limites do texto; isolamento (leitura, gravação, eventos, passo da grade); encerrado e substituto; arquivo do titular; RF14 e colisão; corridas (gravação×gravação, ×saída da aula, ×re-chaveamento, ×virada); lock_timeout; bordas do PRD; e2e de cada RF.
Cobertos: S1–S15, G1–G7, R1–R6, J1–J13, T1–T11; os 11 bloqueantes da rodada 1 resolvidos, menos parte do 4 (cláusulas do Gravar) e do 9 (bordas do PRD).
Bloqueantes: (1) techspec §5 / cenarios G1: o "registro passado" do segundo ramo sem cenário (PUT futuro sobre texto com feriado novo deve dar NAO_ENCONTRADO); (2) prd §7 "Aula dupla" sem cenário de leitura e gravação (cenarios S2/S11); (3) techspec §5/§3/§7c: a gravação não se ordena com o virarAno, e o texto pode passar da virada; falta a trava (FOR SHARE no ano_letivo ou trava dos vínculos no virarAno) e o cenário [P] com ordem forçada.
Recomendações: ponto da pausa em J11; "sem trava, vermelho" em J12; pendente e contestado no PUT (R1); coordenação e aluno direto nas rotas (RF11); registro passado em dia de feriado; tirar o "ano planejado: nada" ou trocar por cenário útil; isolamento do virarAno; storage e saída da conta em T7; "carregando" em T8.
```

## tenancy-guardian · 3ª rodada · REPROVADO · 2026-11-06 13:29:30 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `aula`. Tem `escolaId`, `anoLetivoId` e id UUID v7. A FK composta (escolaId, anoLetivoId, vinculoId) aponta para `vinculo`. Não mudou desde a rodada 2.

Queries verificadas: a gravação (techspec.md:63-68). A ordem agora é: o ano com `for share`, depois a conferência do vínculo (dela, `confirmado`, da escola e do ano do contexto), depois a trava `(escolaId do contexto ‖ vinculoId)` e por fim a aula. A correção exigida na rodada 2 foi feita no texto da spec. A conferência da alocação e do feriado só acontece depois da trava, então não há leitura de `aula` antes dela. O passo da grade (techspec.md:70-72) usa a mesma chave, com a escola do contexto do job, e só lê `aula` depois de travar. Não achei problema novo de escopo nessas duas consultas.

Teste de isolamento: presente mas inútil para a ordem que foi corrigida.

Bloqueantes:
- **cenarios.md:39 (R1, a parte da "trava presa").** Este cenário não falha se a ordem voltar a ser a antiga.
  - **Por que não falha:** a chave da trava é `hashtext(escolaId do contexto ‖ vinculoId)`, como está em techspec.md:65. "A trava dele presa por outra transação" se lê naturalmente como a chave que a própria escola B usa, ou seja `(B ‖ vinculoB)`. Um `PUT` com o token de A, mesmo travando antes de conferir, pegaria `(A ‖ vinculoB)`. Essa chave nunca disputa com a que está presa, então a resposta sai `NAO_ENCONTRADO` na hora nas duas ordens. Na prática, a chave composta já protege o caso de outra escola sozinha.
  - **Onde a ordem importa:** no colega da mesma escola. Ali a chave `(A ‖ vinculoColega)` é a mesma que o `PUT` do colega toma. Com a trava antes da conferência, o `PUT` de outra professora com o vínculo do colega espera enquanto ele grava, e o id inexistente responde na hora. A diferença de tempo confirma que o vínculo existe e está sendo editado (regra 10, item 6). Nenhum cenário cobre esse caso com a trava presa.
  - **Correção exigida:** reescrever a parte da trava presa no R1 em dois casos:
    - (a) Vínculo de colega da mesma escola. Uma conexão do teste segura `pg_advisory_lock(<classe>, hashtext(escolaA ‖ vinculoColega))`, no molde de `apps/api/test/escola-lock.ts`. O `PUT` de outra professora de A com esse `vinculoId` responde `NAO_ENCONTRADO` sem esperar o `lock_timeout`, e a contagem de quem espera na trava continua 0.
    - (b) Vínculo de outra escola. O teste segura a chave que o `PUT` calcularia, `(escolaA ‖ vinculoB)`, e não a chave de B.
    - Nos dois casos, o cenário precisa declarar que fica vermelho se a trava for tomada antes do passo (2).

Recomendações:
- techspec.md:65. Escrever na própria spec que a chave composta é o que isola a disputa entre escolas, e que a ordem protege o colega da mesma escola. Assim ninguém simplifica a chave para só `vinculoId` achando que a ordem basta.
- techspec.md:71. Dizer de onde vem a escola do contexto do job: o registro da importação, nunca o payload que o cliente montou.
- cenarios.md:15 (S7). Está resolvida: a escola B continua intacta na virada.

Arquivos: /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md, /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md

## test-engineer · 3ª rodada · REPROVADO · 2026-11-06 13:31:08 · `tasks/prd-semana-do-professor/revisao-spec.md`

**VEREDITO: REPROVADO**

Dos três bloqueantes da rodada 2, dois estão resolvidos (aula dupla e virada do ano). O primeiro voltou de outra forma, e uma das correções trouxe uma cláusula nova sem cenário que a prove.

**Cenários exigidos:** cada cláusula do "Gravar", inclusive a ordem nova (ano, vínculo, trava do vínculo, aula) e o "passado" do segundo ramo; aula dupla na leitura e na gravação; gravação contra a virada, com a ordem forçada; gravação contra a saída da aula, nas duas ordens e com o ponto da pausa; `lock_timeout` com o código de erro; isolamento da gravação com a trava presa; grade do ano planejado; coordenação e aluno direto nas duas rotas; rascunho fora do armazenamento do navegador; o estado carregando.

**Cobertos:**
- **Bloqueante 2 (aula dupla), resolvido.** O S16 traz cada aula com o próprio texto no `GET`, e o `PUT` numa não altera a outra. Se a leitura casar o registro sem o `inicio`, o teste fica vermelho.
- **Bloqueante 3 (virada), resolvido.** Conferi no código: o `encerrar` (`apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts:53-58`) muda a situação do ano antes do `virarAno`, então o `for share` de `travarAnoEmCurso` (`packages/core/src/estrutura/turma.repository.ts:57-64`) espera o fim do encerramento. Quando volta a ler, acha o ano `encerrado`, e o `PUT` responde `NAO_ENCONTRADO`. Sem a trava do ano, o `PUT` lê o vínculo ainda confirmado, a FK não espera o `update` do vínculo, e a linha fica no ano encerrado: o J14 fica vermelho, como deve.
- **Recomendações da rodada 2 atendidas:** J11a e J11b (com o ponto da pausa), J12 ("tirada a trava, vermelho"), J13 (o código), J15, R1 (pendente e contestado), R7, S7 (escola B e vínculo encerrado antes), T7 (armazenamento e saída), T8 (carregando), G1 (registro passado em dia que virou feriado).

**Bloqueantes:**

1. **`cenarios.md:29` (G1) e `techspec.md:65-67`: o "passado" do segundo ramo continua sem cenário que o derrube.**
   - A correção da rodada 3 levou o "sem feriado nem recesso" para os dois ramos. Com isso, o caso de G1 "data futura com registro já gravado e feriado novo sobre ele" é recusado pelo feriado, mesmo que o "passado" saia do código.
   - O caso "data futura sem alocação" não tem registro, então também não chega ao qualificador. Se o "passado" sair, G1 continua verde.
   - A correção que eu mesmo pedi na rodada 2 deixou de valer quando a minha recomendação do feriado nos dois ramos foi aceita.
   - Correção exigida: um caso em G1 com data futura, em dia útil sem evento, sem alocação do vínculo naquele dia e início, e com registro gravado direto no banco pelo teste. O `PUT` responde `NAO_ENCONTRADO`, e o texto e o `atualizadoEm` ficam intactos.

2. **`cenarios.md:39` (R1, a parte da trava presa) e `techspec.md:63-65`: o cenário não chega à ordem nova, "vínculo conferido, só então a trava".**
   - A chave da trava leva a escola do contexto, `hashtext(escolaId‖vinculoId)`.
   - O `PUT` da escola A com o vínculo de B toma a chave (A, vínculo de B). Quem segura a trava de B usa a chave (B, vínculo de B), que é outra. O `PUT` não espera nem na ordem antiga, e o R1 fica verde se a ordem voltar a ser a antiga.
   - A ordem só aparece quando as chaves coincidem, isto é, na mesma escola. Na ordem antiga, a professora que manda o vínculo de uma colega com a trava presa espera 2 s e recebe `INDISPONIVEL_TENTE_DE_NOVO`. Isso confirma que o vínculo existe (regra 10, item 6).
   - O `tenancy-guardian` apontou o mesmo nesta rodada.
   - Correção exigida: no R1, o `PUT` com o vínculo de uma colega da mesma escola, com a trava dele presa por outra transação, responde `NAO_ENCONTRADO` na hora, sem esperar o `lock_timeout`. Escrever junto "na ordem antiga, vermelho". O caso de outra escola pode ficar, mas não prova a ordem.

**Recomendações:**
- **J11a e J14:** soltar a pausa assim que o banco mostrar o `PUT` esperando trava (`pg_stat_activity` com `wait_event_type = 'Lock'`), nunca com `sleep`, e bem antes dos 2 s do `lock_timeout`. Se a pausa passar de 2 s, o `PUT` responde `INDISPONIVEL_TENTE_DE_NOVO` em vez de `NAO_ENCONTRADO`, e o teste fica vermelho pelo motivo errado, ou só passa com a máquina folgada.
- **J12:** dizer onde fica a pausa, como no J11a. O "tirada a trava, vermelho" já obriga a isso, mas o texto ajuda quem implementa.
- **G1, "registro passado num dia que virou feriado":** dizer que o registro está sem alocação, fora da grade, para o caso passar pelo segundo ramo.
- **§5 "Reimportar", "em ordem de id":** nenhum cenário prova essa ordem. Se o desenho não deixa dois jobs da grade correrem juntos na mesma escola, dizer isso na Tech Spec. Se deixa, um caso [P] com dois jobs que pegam os mesmos vínculos.
- **PRD RF15 ("com o último texto") e G6 ("igual a um dos dois"):** alinhar o texto. Em gravação simultânea, "último" não se observa. O G6 está certo.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/estrutura/turma.repository.ts

```
VEREDITO: REPROVADO
Cenários exigidos: cláusulas do Gravar (ordem nova; "passado" do segundo ramo; feriado nos dois ramos); aula dupla na leitura e na gravação; gravação × virada com ordem forçada; gravação × saída da aula nas duas ordens, com o ponto da pausa; gravação × re-chaveamento; lock_timeout com o código; isolamento da gravação com a trava presa; grade do ano planejado; coordenação e aluno direto nas rotas; rascunho fora do armazenamento; carregando.
Cobertos: S16 (aula dupla: bloqueante 2 resolvido); J14 com travarAnoEmCurso antes de tudo (bloqueante 3 resolvido, conferido contra ano-letivo.service.ts:53-58 e turma.repository.ts:57-64); J11a, J11b, J12, J13, J15, R1 (pendente e contestado), R7, S7, T7, T8, G1 (registro passado sob feriado).
Bloqueantes: (1) cenarios.md:29 / techspec.md:65-67: o "passado" do segundo ramo segue sem cenário que o derrube. Com o feriado nos dois ramos, o caso do feriado novo é recusado sem o qualificador. Exigido: data futura, dia útil, sem alocação, com registro gravado pelo teste → NAO_ENCONTRADO, texto e atualizadoEm intactos. (2) cenarios.md:39 / techspec.md:63-65: a trava presa do R1 usa vínculo de outra escola, cuja chave (com a escola do contexto) nunca coincide, e fica verde na ordem antiga. Exigido: vínculo de colega da mesma escola com a trava presa → NAO_ENCONTRADO na hora; na ordem antiga, vermelho.
Recomendações: J11a e J14 soltam a pausa ao ver o PUT esperando trava em pg_stat_activity, antes dos 2 s do lock_timeout; ponto da pausa no J12; G1 com o registro passado sob feriado explicitamente fora da grade; "em ordem de id" do passo da grade sem cenário (ou dizer que dois jobs não correm juntos); RF15 "último texto" alinhado ao G6.
```

## infra-guardian · 3ª rodada · REPROVADO · 2026-11-06 13:31:27 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: nenhum. A gravação do registro e o passo do job da grade ficam fora do caminho quente, mas a corrida entre eles é regra 80, item 7.
Rate limit: ok. A guarda global já limita por usuário e por escola.
Fila e prioridade: ok. Nenhuma fila nova: o passo roda dentro do `estrutura.gravar-planilha`.
Concorrência: corrida em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md:70` e `:114`. O deadlock possível está no bloqueante 1.
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível. A migration só cria a tabela.
Métrica e alerta: ok. O código fica fora do caminho quente.

**Bloqueantes da rodada 2 (o que foi conferido):**
- **(1) Ano contra a virada: resolvido.** A gravação agora começa por `travarAnoEmCurso()`, em `for share`. O encerramento começa pelo `update` do ano (`ano-letivo.service.ts:53-56`, `#transitar`), antes do `virarAno`. Por isso ele ou espera a gravação terminar, ou a gravação espera o encerramento e relê o ano já encerrado. O J14 prova isso, com o vermelho quando a trava do ano sai.
- **Job da grade × gravação, no ano: sem deadlock.** O job trava o ano em `for share` no passo 3 (`motor.ts:291`, `anoPorId(…, true)`). As duas travas são `for share` e convivem. O ano vem primeiro nos dois lados, então nenhum ciclo passa por ele, nem com um encerramento esperando entre os dois.
- **(2) Ordem do J11: resolvida só em parte.** O J11a está correto. O J11b ainda não força a ordem (bloqueante 2).

**Bloqueantes**

1. **Deadlock entre a gravação e o vínculo marcado "sai da grade"** (`techspec.md:70`, `techspec.md:114`).
   - **O que está errado.** A §5 põe o passo "depois de `gravarAulas`". No código, logo depois de `gravarAulas` vem `encerrarOsMarcados` (`packages/core/src/importacao/tipos/grade.ts:514`). Ele chama `encerrarProfessoresDaGrade`, que trava a linha do vínculo em `FOR UPDATE` (`packages/core/src/estrutura/vinculo.repository.ts:302-308`). Se o passo novo rodar depois disso, as duas transações tomam as mesmas travas em ordem invertida:
     - **o job:** a linha do vínculo X em `FOR UPDATE`, depois a trava consultiva de X (o vínculo encerrado "tem aula que sai", então entra no passo);
     - **a gravação:** a trava consultiva de X, depois o `insert` em `aula`, cuja FK composta pede `FOR KEY SHARE` na linha de X. `FOR KEY SHARE` conflita com `FOR UPDATE`.

     O Postgres desfaz uma das duas com `40P01`. A §5 só converte `55P03`, então a professora recebe erro interno. A "ordem global ano → vínculo" da §7c não diz em que lugar a linha do vínculo entra nessa ordem.
   - **Correção exigida.**
     - Fixar na §5 que o passo da `aula` toma as travas consultivas antes de `encerrarOsMarcados` (antes de qualquer `FOR UPDATE` em `vinculo` no passo 3).
     - Escrever a ordem global como ano → trava consultiva do vínculo → linha do vínculo.
     - Ou: mapear `40P01` para `INDISPONIVEL_TENTE_DE_NOVO` e justificar.
     - Acrescentar o cenário [P]: `PUT` num vínculo confirmado que a grade marca "sai da grade", com a gravação segurando a trava enquanto o job encerra o vínculo. Sem deadlock, e o `PUT` responde `NAO_ENCONTRADO` ou grava antes do job. Com o passo depois de `encerrarOsMarcados`, o cenário fica vermelho.

2. **O J11b ainda não prova que o job lê a `aula` depois da trava** (`cenarios.md:60`).
   - **O que está errado.** Pelo texto, a conexão de teste "segura a trava (molde de `escola-lock.ts`) e grava". Aquele molde usa `pg_advisory_lock` de sessão, então o `insert` confirma na hora, antes de o job chegar à fila. Um job que lesse a `aula` antes de pegar a trava também acharia a linha, apagaria o registro e passaria no teste. O J11b também é o único cenário de corrida sem cláusula de vermelho.
   - **Correção exigida.**
     - A conexão de teste abre uma transação com `pg_advisory_xact_lock(<classe>, hashtext(escolaId‖vinculoId))` e faz o `insert` na alocação velha.
     - Só confirma depois de `esperarNaTrava` mostrar o job parado na trava do vínculo.
     - Acrescentar ao cenário: "com a leitura da `aula` antes da trava, vermelho".

**Recomendações**
- `techspec.md:70`: tomar as travas do passo na ordem do valor da chave (`hashtext(escolaId‖vinculoId)`), não na ordem de id. Com colisão de hash entre escolas, a ordem por id não é a ordem das chaves, e dois jobs podem se travar em cruz. A chance é desprezível e a fila repete, mas a regra fica exata.
- J14: dizer qual mecanismo pausa o encerramento depois do `virarAno`, provavelmente o gatilho de `apps/api/test/write-block-trigger.ts`. Dizer também que o `PUT` é disparado só depois de `esperarNaTrava(… '%from "ano_letivo"%for share%')`, como em `apps/api/test/acesso-da-turma.int.test.ts:666`.
- §7c: acrescentar que a decisão do professor e o `encerrar` da coordenação (ano → turma → linha do vínculo, sem a trava consultiva) não fecham ciclo com a gravação, porque nenhum dos dois toma a trava consultiva. Conferi e não fecham.

## tenancy-guardian · 4ª rodada · APROVADO · 2026-11-06 13:34:06 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: APROVADO

Tabelas verificadas: `aula`, em techspec.md §3. Tem `escolaId`, `anoLetivoId` e id UUID v7. A FK composta `(escolaId, anoLetivoId, vinculoId)` aponta para `vinculo`. Não mudou desde a rodada 3.

Queries verificadas:
- **Gravar** (§5): a ordem é `travarAnoEmCurso()`, depois a conferência do vínculo (escola e ano do contexto, usuário da sessão, `confirmado`), e só então `pg_advisory_xact_lock(<classe>, hashtext(escolaId‖vinculoId))` com a escola do contexto. O upsert tem `setWhere` da escola.
- **Reimportar** (§5, alterado): o passo roda entre `gravarAulas` e `encerrarOsMarcados`. A escola é a do registro da importação. No código de hoje, o job lê o escopo por `requireEscolaId()` em todo o `ImportacaoRepository`, que é o contexto montado a partir desse registro, não um valor vindo do cliente. A trava usa a mesma chave composta, então não cruza escolas. A leitura da `aula` vem depois da trava, e o J6 continua cobrindo o escopo do passo.
- **Ordem global** (§7c): ano, depois a trava do vínculo, depois a linha do vínculo. Ela não cria caminho em que um vínculo de outra escola seja travado ou lido.
- **Leitura** (§5 "Ler"): sem mudança.

Teste de isolamento: presente e efetivo.
- O bloqueante da rodada 3 está resolvido em cenarios.md:40 (R1b).
- (a) A trava fica presa em `(escolaA‖vinculoColega)`, a chave que coincide de verdade dentro da mesma escola. Se a trava voltar para antes da conferência, o `PUT` da outra professora espera os 2 s e recebe `INDISPONIVEL_TENTE_DE_NOVO` em vez de `NAO_ENCONTRADO` na hora. O cenário fica vermelho e distingue "não é seu" de "inexistente".
- (b) A trava fica presa em `(escolaA‖vinculoB)`, a chave que A calcularia. A resposta é a mesma, na hora.
- A asserção "ninguém fica esperando na trava" fecha o caso de passar por tempo.

Bloqueantes: nenhum.

Recomendações:
1. techspec.md §6, última linha: diz "Testes de isolamento: R1 a R6 … e J6". Citar também R1b e R7 pelo nome, já que R7 fica fora do intervalo "R1 a R6" lido ao pé da letra.
2. techspec.md §6, primeiro item: diz "O passo da grade recebe só o ano de destino", e §5 diz "escola do registro da importação". Para não ler a escola como parâmetro da função do passo, deixar explícito que o passo usa `requireEscolaId()` do contexto do job, como o resto do `ImportacaoRepository`.
3. cenarios.md:40 (R1b): dizer na tarefa como se prova o "na hora". Por exemplo, a resposta chega antes de o `PUT` aparecer com `wait_event_type = 'Lock'` em `pg_stat_activity`, ou bem abaixo do `lock_timeout`. Assim a asserção não fica dependendo de tempo de relógio.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/tipos/grade.ts (onde o passo entra, linhas 512-514)

## infra-guardian · 4ª rodada · REPROVADO · 2026-11-06 13:36:20 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: nenhum. O que a spec toca é o job `estrutura.gravar-planilha`, que é lote, e a gravação do professor.
Rate limit: ok. Vale a guarda global por usuário e por escola; não há limite novo por IP.
Fila e prioridade: ok. Não há fila nova; o passo roda no job da grade, que já existe.
Concorrência: corrida em `cenarios.md`, J16. A ordem nova está certa, mas o cenário não força a ordem que a provaria.
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível. Só cria a tabela.
Métrica e alerta: ok. A rota está fora do caminho quente, e o passo (3) já é medido por `aoMedirOPasso3`.

**Os dois bloqueantes da rodada 3, conferidos no código**

- **Bloqueante 1 (ordem das travas): resolvido no desenho.** Hoje o job faz, nesta ordem: trava a importação com `for update`, trava o ano com `for share` (`motor.ts:169`, `importacao.repository.ts:128`), toma a trava do convite, depois usuários e turmas, e então chama `apagarAulas`, `gravarAulas` e `encerrarOsMarcados` (`grade.ts:512-514`). O `FOR UPDATE` dos vínculos (`vinculo.repository.ts:303-308`) só acontece em `encerrarOsMarcados`. Antes disso, o job só toma `KEY SHARE` no vínculo, pela FK da alocação em `gravarAulas`. O insert da `aula` feito pelo `PUT` também toma `KEY SHARE`, e os dois são compatíveis.
  - Pondo o passo da `aula` entre `gravarAulas` e `encerrarOsMarcados`, a trava consultiva vem antes da linha, e o ciclo some.
  - Um vínculo marcado "sai da grade" que tem alocação está sempre no conjunto que o passo trava: nenhuma linha da planilha o cita, então todas as aulas dele saem (`grade.ts:407-409`).
  - Um vínculo marcado sem alocação fica fora do conjunto, mas aí o `PUT` só faz update ou delete de um registro que já existe. Isso não passa pela FK, e não há conflito.
- **Outros caminhos que travam o vínculo: nenhum ciclo novo.** Conferi a virada (`ano-letivo.service.ts:53-60`: primeiro o ano, depois os vínculos, depois a `aula`), o encerramento avulso pela `VinculoRepository.travar`, a desativação, a eliminação com cascata e o `decidir`. Em todos, o `PUT` só espera no ano (o primeiro passo) ou espera sem segurar nada que o outro lado queira.
- **Bloqueante 2 (J11b): resolvido.** A transação do teste segura a trava, grava sem confirmar e só confirma ao ver o job esperando. Com a leitura da `aula` antes da trava, o cenário fica vermelho. Os auxiliares que J11a e J14 citam existem: `esperarNaTrava` e `WriteBlockTrigger`, em `apps/api/test/write-block-trigger.ts:23,43`.

Bloqueantes:

1. **`tasks/prd-semana-do-professor/cenarios.md`, J16: o cenário não prova a correção do bloqueante 1.**
   - **O que está errado.** O deadlock só aparece na ordem errada (passo depois de `encerrarOsMarcados`) se três coisas acontecerem nesta ordem:
     1. a gravação toma a trava consultiva do vínculo;
     2. o job toma o `FOR UPDATE` do vínculo e fica esperando essa trava;
     3. só então a gravação insere a `aula`, e esse insert pede `KEY SHARE` no vínculo.

     Do jeito que o J16 está ("o `PUT` grava antes do job ou responde `NAO_ENCONTRADO`"), a ordem não é forçada. Se a gravação insere antes de o job chegar ao `FOR UPDATE`, o job espera o `KEY SHARE`, a gravação confirma e não há deadlock em nenhuma das duas ordens. O teste fica verde também com o passo no lugar errado.

     Além disso, o motor tenta de novo quando dá `40P01` (`motor.ts:41`). Uma asserção só sobre o estado final esconde o deadlock na nova tentativa.
   - **Correção exigida.** Reescrever o J16 no formato do J11b:
     - Uma transação do teste toma `pg_advisory_xact_lock(<classe>, hashtext(escolaId‖vinculoId))` para um vínculo marcado "sai da grade" e não confirma.
     - O teste espera ver o job parado em `pg_stat_activity` (`wait_event_type = 'Lock'`, `wait_event = 'advisory'`).
     - Só então a transação insere um registro **novo** daquele vínculo, numa data futura e na alocação velha. Tem que ser um insert que passa pela FK, não o `on conflict do update` de um registro que já existe. Depois disso, confirma.
     - Asserções:
       - nenhum `40P01`, nem na transação do teste nem na **primeira tentativa** do job (capturar o erro do passo (3) ou tentar uma vez só, sem nova tentativa);
       - a importação `concluida`;
       - o vínculo `encerrado`;
       - nenhum registro futuro do vínculo no fim, porque o job lê a `aula` depois da trava e o apaga.
     - Com o passo depois de `encerrarOsMarcados`, o insert espera o `FOR UPDATE` do job e o job espera a trava consultiva: dá `40P01`, e o cenário fica vermelho.

Recomendações:

- **`techspec.md` §5, "Gravar", passo (2).** Escrever que a conferência do vínculo é uma leitura sem trava de linha e que não usa `VinculoRepository.travar` (`vinculo.repository.ts:184-194`, que faz `FOR UPDATE`). Esse método é o caminho natural para "o vínculo é dela". Se for usado, a ordem vira linha antes da trava consultiva, e o ciclo com `encerrarOsMarcados` volta. O §7c só proíbe isso de forma implícita.
- **`techspec.md` §5, "Reimportar".** Dizer que "a ordem da chave" é a ordem do valor calculado `hashtext(escolaId‖vinculoId)`, não a do `vinculoId`. Quando duas chaves colidem no hash, jobs de duas escolas rodando ao mesmo tempo ainda tomam as travas na mesma ordem. Hoje o risco termina num `40P01`, que o motor repete.
- **`techspec.md` §3/§5.** A troca só de `fim` numa alocação que continua (o upsert de `gravarAulas`) não atualiza o `fim` copiado na `aula`. O efeito aparece no fora da grade. Vale declarar se isso é aceito.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/tipos/grade.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/importacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/estrutura/vinculo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/api/test/write-block-trigger.ts

## test-engineer · 4ª rodada · REPROVADO · 2026-11-06 13:36:47 · `tasks/prd-semana-do-professor/revisao-spec.md`

**VEREDITO: REPROVADO**

As duas correções que exigi na rodada 3 estão feitas. O J16, que é novo, não força a ordem das transações, e por isso não fica vermelho quando a regra que ele deveria provar some.

**Cenários exigidos:** os que pedi na rodada 3 (o qualificador "passado" do G1 e a trava presa por colega no R1b), mais o que o desenho novo pede: o passo da grade entre `gravarAulas` e `encerrarOsMarcados` (J16), a trava segura até o job esperar (J11b) e o ponto da pausa em J11a, J12 e J14.

**Cobertos:**
- **G1, qualificador "passado"** (`cenarios.md:29`): o caso novo usa data futura, dia útil, sem evento e sem alocação, com o registro gravado direto pelo teste. Se o código perder o "passado", essa gravação passa pelo segundo ramo do "Gravar" e o caso fica vermelho. Os outros ramos não interferem. Resolvido.
- **R1b** (`cenarios.md:40`): no (a), a chave `(escolaA‖vinculoColega)` é a mesma que o `PUT` calcularia. Se a trava vier antes da conferência, o `PUT` espera 2 s e responde `INDISPONIVEL_TENTE_DE_NOVO` em vez de `NAO_ENCONTRADO`, e o caso fica vermelho pelo código da resposta, sem depender de relógio. O (b) também fica vermelho nessa mutação. Resolvido.
- **J11b** (`cenarios.md:61`): o job lê a `aula` em `READ COMMITTED` (o padrão, nenhum `isolation` no `importacao/`), então depois da trava ele vê o registro já confirmado. Se o job lesse antes da trava, ou não travasse, ou usasse outra chave, sobraria o registro futuro, ou o teste nunca veria o job esperando. Nos três casos fica vermelho.
- **J11a, J12 e J14**: o ponto da pausa está dito, e a soltura é por `esperarNaTrava` ou `pg_stat_activity`, que já existem em `apps/api/test/write-block-trigger.ts`. Sem a trava, a espera esgota o prazo e o caso fica vermelho.
- **Ordem global da §7c contra o código atual:** as travas que o job toma antes do passo, em `grade.ts:576-588` (usuários `FOR NO KEY UPDATE` e turmas), não cruzam com nada que o `PUT` trava. O único cruzamento é o `.for('update')` de `encerrarProfessoresDaGrade` (`vinculo.repository.ts:308`) contra o `FOR KEY SHARE` que a FK da `aula` toma. Esse é justamente o caso do J16.
- **Duas importações da mesma escola ao mesmo tempo:** já ficam em fila pela importação `for update` e pela trava do convite da escola. A ordem das travas de vários vínculos no passo não abre deadlock entre jobs.

**Bloqueantes:**

1. **`cenarios.md:65`: o J16 não força a ordem e não fica vermelho com o passo depois de `encerrarOsMarcados`.** O deadlock só acontece numa ordem exata:
   - a gravação segura a trava do vínculo e ainda não inseriu;
   - o job faz o `FOR UPDATE` do vínculo (`vinculo.repository.ts:308`) e para na trava;
   - só então a gravação insere, e a FK pede `FOR KEY SHARE` no vínculo.

   Com duas chamadas soltas em paralelo, o `PUT` termina antes e o caso fica verde mesmo com o passo fora do lugar.

   O caminho óbvio também não serve. Um `PUT` real parado pelo `WriteBlockTrigger` para num gatilho `after … for each row`, e a checagem da FK (`RI_ConstraintTrigger_…`) roda antes dele pela ordem alfabética. A trava da linha já estaria tomada, o job esperaria por ela e não pela trava consultiva, e não haveria deadlock em nenhuma das duas ordens.

   **Correção exigida:** o J16 passa a ser escrito como o J11b.
   - Uma transação do teste toma `pg_advisory_xact_lock(<classe>, hashtext(escolaId‖vinculoId))` do vínculo marcado "sai da grade" e não grava nada ainda.
   - O teste dispara o job e espera vê-lo parado na trava consultiva (`esperarNaTrava` com padrão em `pg_advisory_xact_lock`).
   - Só então a transação do teste insere a `aula` futura desse vínculo e confirma.
   - Asserções, que com a ordem forçada são uma só: nenhum `40P01` nem `55P03` em nenhum dos dois lados, o job confirma, e no fim nenhum registro futuro do vínculo encerrado sobra. Hoje o texto diz "grava antes do job ou responde `NAO_ENCONTRADO`", o que deixa a asserção frouxa.
   - Com o passo da `aula` depois de `encerrarOsMarcados`, o insert espera o `FOR UPDATE` e o job espera a trava, e o Postgres devolve `40P01`. É esse vermelho que o J16 precisa provar.

**Recomendações:**
- **G1 (`cenarios.md:29`):** dizer que cada caso cumpre todas as outras cláusulas. As datas em feriado, em recesso e fora do ano precisam cair num dia da semana e num início em que o vínculo tem alocação. Senão o caso falha por "sem alocação", e tirar a cláusula dele não deixa nada vermelho. O G4 tem o mesmo risco: o vínculo do ano anterior pode ser barrado pela alocação, que também é do ano, antes de chegar à conferência do ano.
- **O limite de "hoje" no "passado":** o J3 trata hoje como futuro ("data ≥ hoje"). Falta um caso com registro de hoje sem alocação, que não aparece no `GET` e não grava, em S14 e G1. Hoje, trocar `<` por `≤` no código passaria.
- **J11b e J16:** o padrão do `esperarNaTrava` deve casar com `pg_advisory_xact_lock`, para provar que o job parou na trava do vínculo e não em outra espera do tipo `Lock`.
- **J13 (`cenarios.md:63`):** "em até 3 s" deixa 1 s de folga sobre o `lock_timeout` de 2 s. É melhor provar o código `INDISPONIVEL_TENTE_DE_NOVO` e que o `PUT` ficou de fato na fila da trava (`esperarNaTrava`), com um limite de tempo largo. Assim o caso não depende de a máquina estar folgada.

Não editei nenhum arquivo. Os documentos estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/`.

## infra-guardian · 5ª rodada · APROVADO · 2026-11-06 13:38:53 · `tasks/prd-semana-do-professor/revisao-spec.md`

**VEREDITO: APROVADO**

```
Caminho quente tocado: nenhum (o passo da grade roda dentro do job de importação do F2, que já existe)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações: 3, abaixo
```

**A correção da rodada 4 foi feita.** O J16 em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md:65` agora segue o formato do J11b, e o teste detecta o erro. Conferi contra o código atual:
- **Passo no lugar errado:** o `encerrarVinculosDeProfessorDaGrade` trava o vínculo com `for('update')` (`packages/core/src/estrutura/vinculo.repository.ts:308`). O insert novo da transação do teste checa a FK composta e precisa de `KEY SHARE` na mesma linha, que conflita com o `FOR UPDATE`. Com o passo depois de `encerrarOsMarcados`, o job fica esperando a trava consultiva enquanto segura a linha, e o insert espera a linha. O resultado é `40P01` ou `55P03`, e o cenário proíbe os dois. Fica vermelho.
- **Passo no lugar certo:** antes do passo, o job não trava nada que o insert precise:
  - escola: trava consultiva do convite, não trava de linha;
  - ano: `for share`;
  - usuários e turmas: `no key update`, e a `aula` não tem FK para elas.
  O insert passa, e o job relê a `aula` em READ COMMITTED (nada no código muda o nível de isolamento), vê o registro e o apaga.
- **`esperarNaTrava`** (`apps/api/test/write-block-trigger.ts:23`) filtra `wait_event_type = 'Lock'`, então pega a espera na trava consultiva.

**As recomendações aplicadas na Tech Spec §5 não abriram nada:**
- **Conferência sem trava de linha:** a gravação e o job seguem a mesma ordem (ano, trava consultiva, linha do vínculo). O encerramento avulso não pega a trava consultiva, então também não cria ciclo; o caso já está aceito na §7c.
- **Ordem de `hashtext`:** a gravação pega uma trava só, e só existe uma importação `na_fila` por escola, então ninguém mais pega várias travas consultivas ao mesmo tempo. Se duas chaves coincidirem, a trava é a mesma e pode ser pega de novo pela mesma transação.
- **`fim` copiado:** só aparece no registro "fora da grade". A aula com alocação mostra o `fim` da alocação.

**Recomendações**
1. **J16 e J11b, prazo do job:** registrar que o job tem `lock_timeout` de 1 s e `statement_timeout` de 1,5 s (`packages/core/src/importacao/importacao.repository.ts:236`). O insert e o commit do teste precisam acontecer dentro dessa janela depois do `esperarNaTrava`, senão o caso falha por `55P03` mesmo com o código certo. Basta citar o prazo no cenário, para ninguém colocar `await` lento entre a espera e o commit.
2. **J16, nome do erro:** com o passo no lugar errado, o vermelho pode aparecer como `55P03` e não como `40P01`, porque o `lock_timeout` de 1 s do job vence junto com o `deadlock_timeout` padrão. A asserção já cobre os dois; o texto "`40P01`, vermelho" pode dizer "`40P01` ou `55P03`".
3. **Padrão do `esperarNaTrava`:** o J16 e o J11b podem também filtrar `wait_event = 'advisory'`. O job pega outra trava consultiva antes do passo (a do convite da escola, `convite-da-escola.repository.ts:78`), com o mesmo texto `pg_advisory_xact_lock`. Hoje ninguém a segura no teste, mas o filtro evita que outro teste no futuro faça a espera casar com a trava errada.

## test-engineer · 5ª rodada · APROVADO · 2026-11-06 13:39:28 · `tasks/prd-semana-do-professor/revisao-spec.md`

VEREDITO: APROVADO

**Cenários exigidos:** a única correção pedida na rodada 4 foi o J16 no formato do J11b: o teste segura a trava consultiva do vínculo, o job para nela, e só então entra o insert novo, que passa pela FK, e o commit. Não pode haver `40P01` nem `55P03` em lado nenhum, nem na primeira tentativa do job. No fim a importação fica `concluida`, o vínculo `encerrado` e não sobra registro futuro. O cenário tem de ficar vermelho com o passo depois de `encerrarOsMarcados`. Também conferi as recomendações da rodada 4 (G1, G4, S14, J11b, J13).

**Cobertos:** conferi o J16 contra o código atual do job, e ele força a ordem certa.
- **Ordem correta:** antes do passo novo, o job trava só linhas que a FK da `aula` não toca. A importação tem `for update`, o ano `for share`, os usuários e as turmas `no key update`, e a trava do convite da escola é consultiva, não de linha (`importacao.repository.ts:346`, `:479`; `grade.ts:576-588`). A `aula` só tem FK para `escola` e para a chave composta do `vinculo`. O `KEY SHARE` do insert do teste não colide com nada disso, e o job passa da trava logo depois do commit.
- **Mutação (passo depois de `encerrarOsMarcados`):** `encerrarProfessoresDaGrade` lê os vínculos com `.for('update')` (`vinculo.repository.ts:308`). O job fica com o `FOR UPDATE` na linha e espera a trava consultiva do teste. O insert do teste espera o `KEY SHARE` nessa mesma linha. Os dois se esperam em cruz, e o resultado é `40P01` ou `55P03`. A asserção "nenhum dos dois, nem na primeira tentativa" pega os dois casos, então o vermelho vem pelo motivo certo.
- **Por que tem de ser insert novo:** o `on conflict do update` que não muda as colunas da FK não faria a checagem da FK. Daria verde mesmo com o código errado. O texto já exclui esse caminho.
- **Bônus:** com a leitura da `aula` antes da trava, a asserção "nenhum registro futuro do vínculo" também fica vermelha.
- **Recomendações da rodada 4, todas aplicadas:**
  - G1: cada caso cumpre as outras cláusulas e há o caso de "hoje", vermelho com `<` trocado por `≤`.
  - G4: tem alocação.
  - S14: tem o fora da grade de hoje.
  - J11b e J16: usam `esperarNaTrava` com padrão em `pg_advisory_xact_lock`.
  - J13: a prova é a fila da trava e o código, não o tempo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Prazo do job no J11b e no J16 é de 1 s, não 2 s** (`cenarios.md:61`, `:65`). O job espera a trava sob o `lock_timeout` de 1 s e o `statement_timeout` de 1,5 s do passo (3) (`importacao.repository.ts:234-237`). Os 2 s são do `PUT`. Entre o `esperarNaTrava` (que confere a cada 20 ms) e o commit do teste cabem só o insert e o commit, e não deve entrar nada que demore. Vale escrever isso no cenário para quem implementar não pôr ali um passo lento e tornar o teste dependente de máquina folgada.
2. **Padrão do `esperarNaTrava` mais estreito no J11b e no J16.** O job também chama `pg_advisory_xact_lock` na trava do convite da escola (`travarConviteDaEscola`, `motor.ts:283`). Hoje ninguém segura essa trava no teste, então não há falso positivo, mas um padrão com a classe própria da trava do vínculo fica imune a isso.
3. **Texto do vermelho do J16** (`cenarios.md:65`): onde está "`40P01`, vermelho", melhor "`40P01` ou `55P03`". Os dois prazos de 1 s (o `deadlock_timeout` padrão e o `lock_timeout` do passo) disputam qual erro aparece primeiro. A asserção já cobre os dois; só o texto não.
4. **"O erro do passo (3)" é ambíguo no J16.** Aqui é o passo (3) do motor (`motor.ts:255`), mas na Tech Spec §5 o "(3)" do "Gravar" é a trava do vínculo. Basta escrever "o erro de `executarPlanilha` na primeira chamada".

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/tasks/prd-semana-do-professor/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/tipos/grade.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/motor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/importacao/importacao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/packages/core/src/estrutura/vinculo.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor/apps/api/test/write-block-trigger.ts`
