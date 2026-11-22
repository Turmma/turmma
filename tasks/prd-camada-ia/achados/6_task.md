# Achados das revisões — `tasks/prd-camada-ia/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 23:23:32 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** as faltas da 7ª rodada para a 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0 e 9.0; as da 10.0, como o prompt as resume; e a carga da `cenarios.md` §5, agora na 11.0.

**Cobertos:** quase todas as faltas foram corrigidas.

- **2.0:** a precedência com R$ 3, o "hoje" de São Paulo, as duas vigências e o `EXPLAIN` num ano da maior escola.
- **3.0:** a corrida com a escola sem linha, o `GET /redes` e `/escolas`, a rede inexistente, e professor e aluno com 404. A referência "(7.0)" foi corrigida.
- **4.0:** o alerta do teto cita "Classificação do material atrasada" (linha 60).
- **5.0:** `ordem=custo` em `/escolas` e o 404 em `…/uso-ia`.
- **6.0:** os textos do Painel por estado, os estados da Governança, "Atualize a página", o e2e a 360 px e o `EXPLAIN` do `porFuncao`.
- **7.0:** os rótulos, "Vale hoje", "Orçamento salvo.", os limites com `aria-describedby` e `role=alert`, `Esc` com foco preso, os alvos de 24 px e "Atualize a página".
- **8.0:** "Ver meses" a 360 px, carregando e erro, o mês em pt-BR, a acessibilidade e "Atualize a página".
- **9.0:** cada recusa da subida tem linha própria (linhas 56 a 59), a chave nunca aparece no erro, produção aceita outro provedor e `staging` aceita o falso, a reserva recusada publica 0, e estão lá o reinício, as duas tarefas e o motivo `categoria_faltando:conversa_do_aluno`.
- **10.0:** a reserva recusada e depois corrigida no roteamento (linha 56), a repetição na reserva (53), `pelo_provedor_de_reserva` com `true` e `false` (58), o 429 sem quinta chamada (52) e `IA_FALHA_FALSA` recusado em produção (60).
- **11.0:** as três linhas de carga (55 a 57), com as subtarefas 11.5 e 11.6 e os arquivos `infra/scripts/carga.ts`, `infra/k6/reserva.js` e `infra/test/carga.test.ts`.

Todos os documentos ficaram dentro do teto: 1.0 e 3.0 estão em 800 palavras exatas, as outras entre 600 e 799.

**Bloqueantes:**

1. **A Governança não testa os textos do orçamento** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/6_task.md:54`).
   - **O problema:** a subtarefa 6.4 põe a porcentagem e o aviso na Governança, e a `cenarios.md` §4 dá os mesmos textos por estado a "Coordenação, Painel e Governança". A linha 54 só testa o Painel, e a linha 55 só testa o texto por função e os estados de carregamento. Se a Governança mostrar o aviso errado, ou não mostrar o aviso de 100, nenhum teste falha.
   - **A correção:** trocar "Painel, o texto exato…" por "Painel e Governança, o texto exato da `cenarios.md` §4 por estado…". São duas palavras a mais e o documento fica com 794.
   - Essa falta vem da minha 7ª rodada, não da correção: lá eu pedi só o texto do Painel.

2. **Referência deixada para trás quando a carga mudou de tarefa** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/9_task.md:75`).
   - **O problema:** "Fora do escopo" ainda diz "O roteamento e a carga (10.0)", mas a carga agora é da 11.0.
   - **A correção:** "O roteamento (10.0); a interrompida e a carga (11.0); os relatórios reais (13.0)."
   - Não falta teste aqui. Conto como bloqueante porque a correção desta rodada, que movia a carga, deixou esse erro, e a mesma classe de erro foi exigida na rodada anterior. É uma troca de uma linha.

**Recomendações:**

- **4.0, linha 55 ou uma linha nova:** a subtarefa 4.3 diz "sem série em escola `sem_orcamento` ou `sem_aluno_ativo`", mas a tabela não tem teste para isso. Se a medida dividir por zero alunos, a série pode dar infinito e o alerta de 100% dispara à toa. Sugiro `| escola sem_orcamento e sem_aluno_ativo: nenhuma série publicada | I | sem divisão por zero |`. Cabe, porque o documento fica em cerca de 799 palavras.
- **11.0, linha 56:** a queda por prazo e o balde cheio no pico estão juntos por ponto e vírgula. Os dois resultados estão escritos, então nenhum ficou sem teste, mas são duas situações diferentes da carga e cada uma deve dar o seu número no relatório.

Arquivos auditados, todos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/`: `tasks.md`, `1_task.md` a `13_task.md` e `cenarios.md`.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 19:40:59 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. A tarefa lê `consumo_ia`, `orcamento_ia_do_mes`, `configuracao_operacional_escola`, `rede` (pelo `escola.rede_id`), `vinculo`, `usuario`, `ano_letivo` e `auditoria`, e todas já têm `escola_id`.

Queries verificadas:
- `GovernancaRepository.consultaDoConsumoPorFuncao` e `consumoPorFuncao` em `apps/api/src/governanca/governanca.repository.ts`: o escopo é `requireEscolaId()`.
- `OrcamentoDoMesRepository.doMes`, que passa por `custoDoMes`, `alunosAtivos`, `configuracaoDaEscola`, `configuracaoDaRede` e `retrato`, em `packages/core/src/ia/orcamento-do-mes.repository.ts`: todos usam `requireEscolaId()` e nenhum é `@Unscoped`.
- `GET /v1/governanca/consumo`: o `consumoQuerySchema` é estrito e só aceita `mes`. `escolaId`, `alunoId` e `origem` na query são recusados com `ENTRADA_INVALIDA`, e o teste cobre isso.
- O cliente web (`api/governanca.ts`) não manda `escolaId`.
- Professor e aluno recebem `NAO_ENCONTRADO` em `/consumo`, igual ao recurso inexistente.
- `parte` e `porcentagem` são agregados da escola por função, sem pessoa, sem token e sem custo, e o schema estrito recusa esses campos.
- Nenhum `@Unscoped()` novo.
- Os ids continuam UUID.

Teste de isolamento: presente e efetivo.
- Tirar `escola_id` de `consumoPorFuncao` quebra "soma por função… e não soma o de outra escola": as execuções de A passariam a incluir as de B, que o teste compara com o banco filtrado.
- Tirar `escola_id` de `custoDoMes` ou de `alunosAtivos` quebra "a coordenação de A lê 20% e a de B lê 111%": os dois números deixariam de bater.
- Tirar `escola_id` de `configuracaoDaEscola` deixa a leitura com várias linhas, e o mesmo caso deixa de dar 20% e 111%.

Bloqueantes: nenhum.

Recomendações:
1. O item 11 da autoconferência em `tasks/prd-camada-ia/6_task.md` diz que tirar `escola_id` do `consumoPorFuncao` deixa vermelho o caso "A lê 20% e B lê 111%". Não deixa, porque esse caso só olha `orcamento`. Quem prova esse escopo é "soma por função… e não soma o de outra escola", e o texto deveria citar esse caso.
2. O caso "o mês fechado a 120% não traz aviso" só grava retrato para A em `2020-03`. Se o filtro de escola sair de `retrato()`, o teste continua verde. Gravar para B, no mesmo mês, um retrato com outro valor e conferir que A continua lendo 120% prova o escopo do mês fechado pelo caminho da Governança. Esse método vem da 2.0 e não mudou aqui.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 19:41:17 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A tarefa só mexe na leitura `GET /v1/governanca/consumo`, no contrato dessa resposta, nos textos do Painel e da Governança, na documentação e nos testes. Todos com autor humano? Não se aplica: a tarefa não grava Nota nem cria caminho novo de escrita.

Decisão autônoma sobre aluno: ausente. O aviso de 80% e de 100% é só informativo e diz "Nada é cortado". Nenhum fluxo automático depende dele.

Aprovação registrada: ok. O fluxo de aprovação não mudou. As fotos da Governança mostram cada entrega com "Aprovado por um professor" e a data, e explicam que quem decidiu fica na auditoria. A exceção do tutor (D47) não aparece em outro agente.

Supervisão do tutor: ok. Não mudou. A tela mostra só o total de trocas contra o pacote da turma, sem nada por aluno.

Autonomia declarada e visível: sim. "Como cada IA trabalha" e a tabela "O que a IA gerou e quem aprovou" continuam na Governança, e o diff não toca nessa parte (`coordenacao--coordenacao-governanca--computador.png`).

O que conferi pela regra 70:
- **Itens 8 e 9 (D45, D64).** O consumo continua somado por função e nunca por pessoa. Isso está no contrato:
  - `packages/shared/src/governanca/governanca.ts:1041` usa `consumoResponseSchema` estrito.
  - O teste `governanca.test.ts`, caso "o consumo é por função…", recusa campos de professor, `porAluno` e `porUsuario` no topo e em cada função.
  - A consulta não aceita `professorId` nem `alunoId`.
  - Nenhuma tela mostra ranking ou adoção por nome. A frase da tela "não existe consumo por professor nem por aluno" continua.
- **Item 6.** A auditoria de alteração de orçamento é da Operação. O caso "as alterações de orçamento de A estão na auditoria…" prova que ela existe e que nenhuma resposta da governança da coordenação a devolve. A pergunta "o que a IA gerou, quem aprovou e quando" segue respondida pela tabela e pela auditoria, que esta tarefa não alterou.
- **Item 7.** Não entra nenhum dado de comportamento, tempo ou navegação. O orçamento é agregado da escola: `situacao`, `porcentagem` e `aviso`, sem valor por aluno nem número de alunos (o schema estrito recusa esses campos).
- **D55 e a nota proposta (item 8 do pedido).** Não há campo, tela nem prompt com nota, conceito ou sugestão de nota. As fotos do Painel e da Governança, nas escolas cheia e vazia, no computador e no celular, mostram só porcentagem do previsto, parte por função, execuções e trocas do Tutor.
- **D59.** O aviso de 100% não pressiona nem induz uso, e não há barreira para sair.

Bloqueantes: nenhum.

Recomendações:
1. **Escola com um professor só.** A linha "Assistente de ensino · Conversa e ferramentas" com parte e execuções conta, na prática, o uso daquele professor. A D45 revista diz que recorte com um professor só conta como nominal. Isso já acontecia antes desta tarefa, porque as execuções por função já apareciam. Fica para a validação e a retro decidirem se a linha por função precisa do mesmo piso de dois professores que vale para o painel por série e disciplina (`apps/web/src/areas/coordenacao/governanca/Governanca.tsx`, `Consumo`).
2. **Texto do aviso de 100%.** "a equipe Turmma vai conversar com vocês se isso se repetir" pode ser lido como cobrança. Vale confirmar com o Gabriel que o tom combina com a D40, que garante a escola sem crédito para controlar.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-21 19:41:36 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: APROVADO

Tela vista: sim (10 fotos lidas: Painel e Governança, no computador e no celular, na escola cheia e na vazia). A Governança no celular veio em dois pedaços, e li os dois. A foto do computador corta o fim da página, porque o miolo rola por dentro. A linha `Rolam a 1366 × 768` diz "nenhuma", então não há tela que o PRD ou o `docs/interface.md` mande caber e que estoure. Nas fotos, o que a tarefa muda é a linha do orçamento e o consumo por função. Só o estado `sem_orcamento` aparece nelas, como o prompt avisou. Os outros estados eu conferi pelo código e pelos testes.

Estados: ok.
- Carregando: `LoadingState` no Painel (`Painel.tsx` › `OConsumoDoMes`) e na Governança (`Governanca.tsx` › `Consumo`).
- Erro: `FalhaDoConsumo` mostra "Tentar de novo". Quando a resposta vem fora do contrato, mostra "Atualize a página" e não oferece tentar de novo.
- Vazio: na Governança, mês sem execução mostra "Nenhuma função trabalhou neste mês", que diz o que fazer e aparece na foto da escola vazia. No Painel, sem valor definido, a linha diz por que não há porcentagem.
- Com dado: porcentagem com aviso a 80% e a 100%, mais a `parte` de cada função.

Acessibilidade:
- O aviso usa `Alert` com glifo e texto, então não depende só de cor. Não tem `role` vivo, o que é o padrão do componente para aviso que já está na tela ao abrir.
- A falha de leitura usa `role="alert"`.
- Nada depende de hover.
- O axe saiu do primeiro caso de `e2e/governanca.spec.ts`, mas continua nos casos das linhas 123, 131, 177 e 356. O comentário do spec diz isso.

Chromebook fraco: sem impacto. A tarefa não traz lista nova nem imagem. O consumo é uma leitura leve, e o `EXPLAIN` do índice tem teste próprio (`governanca-consumo.plano.int.test.ts`).

Celular:
- A 360 px não há rolagem horizontal nas fotos.
- O texto "75% do que a IA trabalhou no mês · 2 execuções" quebra de linha dentro do cartão.
- Esse texto é a correção de `ProgressBar.tsx:31`. Ela tem prova em `e2e/governanca.spec.ts`, que confere que o valor não sai do cartão.
- O botão "Ver em Registros" tem cerca de 44 px de altura na foto.

Ação oficial protegida: sim, por não se aplicar. A tarefa só lê e não aprova, publica nem exporta. A tela não mostra real, token nem crédito (D40). Nenhuma saída de IA chega ao usuário, então a marca "é IA" não se aplica. O consumo é por função, nunca por pessoa (D64).

Bloqueantes: nenhum.

Verificação: rodei `vitest` em `governanca`, `painel` e `client.test.ts` (207 testes, todos passaram). Não rodei os e2e do Playwright.

Recomendações:
1. `apps/web/src/areas/coordenacao/governanca/OrcamentoDoMes.tsx:29-34` refaz à mão a caixa de erro que o `ErrorState` já desenha (`ErrorState.tsx:25`) e que existe também como `Alert tom="erro"`. O markup é idêntico ao do `ErrorState`, então não há deriva hoje. Convém centralizar a variante "Atualize a página" em um só componente de estados, porque a Operação já tem uma cópia dessa caixa (`CascaDaOperacao.tsx:141`).
2. "Atualize a página" é só texto. Um botão "Atualizar a página" (`location.reload`) pouparia o passo a quem está no celular. Vale como melhoria do texto de erro, na validação.
3. A foto do computador não mostra o consumo por função da Governança, porque ele fica abaixo da dobra do miolo. A conferência a 1366 px dessa coluna estreita fica por conta do projeto `chromebook` do e2e, e a validação deve olhá-la.
4. `e2e/governanca.spec.ts:327-330` seleciona `p > span.font-semibold` para achar o valor da barra. O seletor depende das classes do `ProgressBar` e quebra se elas mudarem. Um `data-testid` ou um papel acessível seria mais estável.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 19:41:56 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa mexe só em agregado por escola e por função: `parte`, `execucoes`, o orçamento do mês (`situacao`, `porcentagem`, `aviso`) e as trocas com o Tutor somadas. A rota também passou a expor menos do que antes. Saíram da resposta da coordenação `tokensDeEntrada`, `tokensDeSaida`, `custoMicros` e `comEnvioExterno` (`packages/shared/src/governanca/governanca.ts`, que agora usa `strictObject` em todos os níveis). A consulta `consultaDoConsumoPorFuncao` (`apps/api/src/governanca/governanca.repository.ts:179-190`) continua sem ler `aluno_id`, `origem`, `entrada` ou `saida`.

Fora da tabela de dados do docs/lgpd.md: nada. A tarefa não cria campo novo nem migration.

Autorização por objeto: ok.
- A rota `GET /v1/governanca/consumo` não recebe id. O escopo vem do contexto: `requireEscolaId()` no `consultaDoConsumoPorFuncao` e em todas as consultas do `OrcamentoDoMesRepository` (`packages/core/src/ia/orcamento-do-mes.repository.ts`, linhas 160, 171, 234 e 248).
- O `?mes=` só escolhe o período, não a escola.
- Pela matriz de permissões, `ler_consumo` vale para a coordenação (`agregado`) e é `nunca` para rede, professor e aluno.
- Há casos de integração para as duas coisas: "coordenação de A lê 20% e a de B lê 111%" e "professor e aluno não alcançam nenhuma rota da governança" (404).

Logs: limpos. O diff não adiciona nenhum `logger` nem `console`.

Auditoria: não se aplica. A leitura é agregada da escola, sem dado de aluno nem indicador nominal de professor. A auditoria de alteração do orçamento é da Operação (7.0). Esta tarefa testa que ela continua registrada e que nenhuma resposta da governança da coordenação a devolve ("as alterações de orçamento de A estão na auditoria…").

Envio externo: nenhum. A tarefa não chama provedor de IA.

Seed/fixture: sintético. `apps/api/test/governanca-consumo.plano.int.test.ts` cria "Rede do plano" e "Escola grande/media/pequena" num banco temporário. As fotos mostram "Colégio sintético da vitrine" e "Coordenadora sintética".

Fotos (Painel e Governança, escola cheia e vazia, computador e celular):
- Nenhum nome de aluno ou de professor, nenhuma matrícula e nenhum conteúdo de conversa aparece.
- O consumo aparece só por função, por exemplo "Assistente de ensino · 75% do que a IA trabalhou no mês · 2 execuções" (`coordenacao--coordenacao-governanca--celular-2.png`, produzido por `Governanca.tsx`, `ProgressBar` com `textoDaParte`).
- Nenhuma foto mostra real nem token. O Painel mostra só a frase do orçamento e "Trocas dos alunos com o Tutor: 0 de 600 trocas" (`coordenacao--coordenacao-painel--computador.png`, produzido por `Painel.tsx` › `OrcamentoDoMes`).

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso vai. `consumo_ia` com `aluno_id` continua sendo lido pelo arquivo do titular, que já existia e não foi tocado. A resposta continua a mesma de antes.

Bloqueantes: nenhum.

Recomendações:
- O JSDoc da 2.0 diz que `doMes` "não grava nada"; está certo, quem grava é `regravarRetrato`. Vale manter um teste que prove que o `GET` da coordenação não chama `regravarRetrato`, para a leitura nunca virar escrita sem ninguém perceber.
- Com poucas execuções ("Tutor · 1 execução"), o número fica pequeno numa escola pequena. Hoje não identifica ninguém, porque não há turma nem pessoa ao lado. Se um dia a tela ganhar recorte por série ou turma, aplicar ali o mesmo grupo mínimo da D45.

Arquivos auditados:
- apps/api/src/governanca/governanca.service.ts
- apps/api/src/governanca/governanca.repository.ts
- packages/shared/src/governanca/governanca.ts
- packages/core/src/ia/orcamento-do-mes.repository.ts
- apps/web/src/areas/coordenacao/governanca/OrcamentoDoMes.tsx
- apps/web/src/api/contrato/resposta-fora-do-contrato.ts
- apps/api/test/governanca-consumo.plano.int.test.ts

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 19:41:57 · `tasks/prd-camada-ia/6_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- apps/api/src/governanca/governanca.repository.ts:184-185: a soma dos tokens do mês faz cast para `::int`, que estoura em cerca de 2,1 bilhões por função. O cast já existia antes desta tarefa e hoje está longe do limite. Mesmo assim, agora a `parte` depende só desse número, então vale trocar para `::float8` ou `::bigint` e evitar um erro 500 num mês de muito uso.
- apps/api/src/governanca/governanca.service.ts:128 e :133: `consumoPorFuncao` e `OrcamentoDoMesRepository.doMes` (pelo `custoDoMes`) leem a mesma faixa do mês no `consumo_ia_mes_idx`, uma vez cada. São duas leituras só no índice, numa rota da coordenação que não se atualiza sozinha (`semLeituraSozinha`), então dá para aceitar. Se o Painel um dia passar a se atualizar sozinho, junte o `sum(custo_micros)` na consulta por função para ler o índice uma vez só.
```

Conferido sem bloqueante:
- **Rate limit:** a rota passa pelo limitador global, que já limita por usuário e por escola (`porUsuarioMin` e `porEscolaMin`, em `apps/api/src/rate-limit.module.ts`).
- **Escrita:** nada é gravado e nenhum job é posto na fila.
- **Índice:** o `EXPLAIN` do ano da maior escola prova leitura só no `consumo_ia_mes_idx`, entrando por `escola_id` e pela faixa de `em`, sem buscar na tabela, e o teste lê a consulta que o serviço executa de fato.
- **Retentativa:** a `RespostaForaDoContrato` não é repetida sozinha (`query-client.ts`), o que evita repetir a mesma resposta errada logo depois de um deploy.
- **Contrato:** a mudança quebra a web antiga lida pela API nova, e esse caso tem resposta: a tela diz "Atualize a página".

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 19:42:48 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As subtarefas 6.1 a 6.7 foram feitas. A troca de lugar da `RespostaForaDoContrato` e do `lidoPeloContrato` (de `operacao/` para `apps/web/src/api/contrato/`), a mudança no `shouldRetry` e a do `ProgressBar` estão declaradas em "Arquivos previstos". A tarefa não mexeu na Operação (7.0 e 8.0) nem no sino.

Aderência à Tech Spec: ok. O contrato de `GET /v1/governanca/consumo` segue a §4: `orcamento { situacao, porcentagem, aviso }` e `porFuncao [{ funcao, parte, execucoes }]`, com schema estrito e sem tokens nem custo. O `EXPLAIN` do `porFuncao` exigido pela §7c ("Laços e índices") existe. A única divergência ("Atualize a página" no lugar do `ErrorState`) já está registrada na `techspec.md` §7c e na `cenarios.md` §4.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

As fotos batem com a §4. O Painel e a Governança, na escola cheia e na vazia, mostram o texto de `sem_orcamento` e as trocas com o Tutor. A Governança no celular mostra "75% do que a IA trabalhou no mês · 2 execuções", que quebra a linha dentro do cartão. Nenhuma tela mostra "R$", "token" nem "crédito".

Recomendações:
1. **Texto de `sem_retrato` só existe na doc e no código.** Ele está em `docs/interface.md:574` e em `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:113`, mas não na `cenarios.md` §4, que é de onde os textos da coordenação vêm. Convém registrá-lo lá. Hoje ninguém chega a ver esse texto, porque a web nunca manda `?mes=` e o mês corrente nunca é `sem_retrato`.
2. **Mapeamento que esconde um caso impossível.** Em `textos-da-governanca.ts:128`, `situacao === 'definido' ? 'sem_retrato' : situacao` faz o `definido` sem porcentagem cair no texto de um mês fechado. O `refine` do contrato já impede esse caso, então só serve ao tipo. Um ramo explícito para o impossível, ou um texto neutro, deixaria a regra mais legível.
3. **Segundo jeito de montar a caixa de erro.** `FalhaDoConsumo` (`apps/web/src/areas/coordenacao/governanca/OrcamentoDoMes.tsx:27-34`) monta a caixa à mão (`border-erro bg-erro-cx` com `role="alert"`). O `Alert tom="erro"` já faz isso, com o glifo e o `role` só no texto, como pede `docs/interface.md` 10.2. Usar o componente evita um segundo jeito de fazer a mesma coisa. A parte visual é do `frontend-reviewer`.
4. **"Tentar de novo" diferente nas duas telas.** O do Painel (`apps/web/src/areas/coordenacao/painel/Painel.tsx:154`) chama `consumo.refetch()` sem `cancelRefetch: false`, e o da Governança passa essa opção. Para o mesmo consumo, valeria um comportamento só.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-21 19:44:21 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: o orçamento `definido` com a porcentagem, e a `parte` de cada função com as execuções.
- Bordas: 79%, 80% exatos, 99%, 100% e 120%. O `?mes=` de um mês fechado, lido pelo retrato dele. O mês seguinte. A escola sem valor (`sem_orcamento`), a escola sem ano em curso (`sem_aluno_ativo`) e o mês sem retrato (`sem_retrato`). O mês sem nenhum token. A execução gravada em duas linhas de consumo. A linha sem execução.
- Permissão: professor e aluno recebem 404.
- Isolamento: a coordenação de A lê 20% e a de B lê 111%.
- Contrato: o schema estrito recusa `tokens*` e `custoMicros`, e a web antiga lendo a API nova mostra "Atualize a página".
- Tela: os quatro estados no Painel e na Governança, e 360 px sem rolagem com a porcentagem e o aviso escritos.
- Concorrência: não se aplica, a leitura não grava nada.

**Cobertos:**
- O schema, no topo, na função e no orçamento, e a `parteDosTokens`, em `governanca.test.ts`.
- Na integração: o aviso de 79 a 120%, o mês fechado, `sem_orcamento`/`sem_aluno_ativo`/`sem_retrato`, a parte que soma 100, o zero token, a linha sem execução, o isolamento A 20% / B 111%, o 404 de professor e aluno (com `/consumo`) e a auditoria fora da governança.
- Os textos exatos de cada estado, incluindo o estado fora do contrato.
- No Painel e na Governança: carregando, erro que relê só o consumo, resposta fora do contrato, e o mês sem execução.
- `shouldRetry` com a `RespostaForaDoContrato`.
- O `EXPLAIN` lê a consulta real (`.toSQL()`) e confere Index Only Scan, `Heap Fetches = 0` e a faixa de linhas lidas.
- Não há `.skip`, nem teste comentado, nem mock de coisa nossa. Nenhum provedor pago é chamado.
- Rodei a unidade e a web da tarefa (8 arquivos, 185 casos): tudo verde.
- **Não rodei** `governanca.int.test.ts`: o setup recusou porque há despachante e workers de pé no compose de teste 2, e não os derrubei porque podem ser de outra sessão. As mutações desse arquivo valem pela prova do portão.

**Bloqueantes:**

1. **`apps/api/src/governanca/governanca.int.test.ts:593-609` não tem a asserção que o nome promete.** O caso diz "os tokens das duas linhas pesam na parte", mas não afirma nenhuma `parte`, só que as execuções não mudaram. A versão anterior afirmava +1000 de entrada e +500 de saída, e isso saiu sem substituto.
   - O bloco do `tokensDoMes` (`6_task.md:131-136`) fica vermelho pelo motivo errado. Sem os tokens de saída, a `parte` passa de 100, o `consumoResponseSchema.parse` do serviço lança, e o 500 derruba o `expect(status).toBe(200)` do `consumoDe`. Quem pega é a guarda do contrato, não a asserção.
   - Isso também depende das funções que o mês corrente de A tiver: com várias, nenhuma passa de 100 e o bloco fica verde.
   - Uma regressão que deixe de somar os tokens da segunda linha da execução passa em todos os casos. O "soma por função" compara com a soma do banco, onde nunca há uma execução com duas linhas.
   - **Correção exigida:** num mês fechado, gravar a função X com uma execução de duas linhas, (entrada 500, saída 0) e (entrada 0, saída 500), e a função Y com uma linha de entrada 3000. Esperar `[{X, parte: 25, execucoes: 1}, {Y, parte: 75, execucoes: 1}]`. Sem a saída no denominador, X dá 29 e Y dá 86. Sem a segunda linha, X dá 14. O bloco do `tokensDoMes` deve citar este caso.

2. **A linha 62 da tabela, na parte "aviso e porcentagem com texto" a 360 px, não tem teste.** Todos os e2e citados só mostram `sem_orcamento`:
   - `e2e/painel-da-coordenacao.spec.ts:62-64` e `:97`
   - `e2e/governanca.spec.ts:94-104` e `:311-356`
   - `e2e/roteiro-da-demonstracao.spec.ts:828`: o regex aceita qualquer um dos três estados, então passa sempre.

   As fotos da vitrine confirmam: só aparece "O previsto de IA da escola ainda não foi definido". Nenhum teste põe na tela, no computador nem no celular, "IA do mês: N% do previsto." nem o `Alert` de 80 ou de 100. O aviso de 100 é a frase mais longa da linha, e foi exatamente a 360 px que o valor da `ProgressBar` estourou o cartão nesta mesma tarefa. O texto em si já está provado pela unidade; o que falta é o leiaute.
   - **Correção exigida:**
     - Na montagem da escola do e2e, definir um valor por aluno e um consumo de 100% ou mais, por SQL no suporte, como já faz o `montarEscolaComEntregas`.
     - No Painel e na Governança, afirmar o texto da porcentagem e o do aviso de 100, nos dois projetos, com `horizontalOverflow` 0, `paginaNaoRola` e `seriousViolations`.
     - No roteiro, trocar a alternância do regex pelo texto do estado que a escola dele realmente tem.

**Recomendações:**
- **RF9 "no mês seguinte" e a virada do mês em São Paulo.** Falta um caso com relógio falso perto da meia-noite do último dia. Hoje o serviço usa `mesDeSaoPaulo(relogio.agora())`, mas o `custoDoMesCorrente` do teste usa o `now()` do Postgres, então o caso do aviso pode falhar se rodar na virada do mês.
- **Autoconferência 11 (`6_task.md:105-106`).** Ela diz que tirar o `escola_id` do `consumoPorFuncao` deixa vermelho o caso "A lê 20% e B lê 111%". Não deixa: esse caso só lê o `orcamento`. Quem pega é o "soma por função". Corrigir o texto ou acrescentar o `porFuncao` ao caso.
- **`Governanca.tsx`, `valor={linha.parte}` da `ProgressBar`.** Nenhum teste afirma o tamanho da barra. Trocar por `valor={0}` passaria.
- **O retrato do `?mes=` fechado.** Falta o caso de B ter retrato num mês e A não o ler, a menos que a 2.0 já tenha. Confirmar.
- **O caso da auditoria (6.3)** grava a linha por SQL. Gravar pelo `PUT` da Operação provaria o caminho real.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 21:18:31 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Conferi o diff entre as árvores `eb842e4f` e `5102a8ff`. Ele mexe só em teste, e2e e documento da tarefa. Nenhum código de produção mudou, então não reauditei o que já estava aprovado na 1ª rodada.

As duas correções exigidas pelo `test-engineer` estão feitas:
- **Duas linhas de consumo:** `apps/api/src/governanca/governanca.int.test.ts`, no caso "a execução com duas linhas de consumo…", agora confere a `parte` exata num mês fechado: Assistente com 500 + 500 em duas linhas contra Tutor com 3000, o que dá 25% e 75%, com uma execução cada. Se faltar a saída no denominador ou a segunda linha, o número muda e o teste quebra.
- **e2e além de `sem_orcamento`:** o novo `passarDoPrevistoDeIa` (`e2e/support/governanca.ts`) põe a escola em 120%. Ele conta os alunos ativos com a mesma regra de `alunosAtivosDaEscola` (`packages/core/src/ia/orcamento-do-mes.repository.ts:26`). Com isso, `e2e/painel-da-coordenacao.spec.ts` e `e2e/governanca.spec.ts` passam a ver "IA do mês: 120% do previsto." e o aviso de 100%. No Painel, `horizontalOverflow` foi trocado por `paginaNaoRola`, que é mais rígido.
- **Roteiro:** `e2e/roteiro-da-demonstracao.spec.ts` deixou a regex de três estados e agora exige o texto exato de `sem_orcamento`.

O que mais entrou no diff também está em ordem:
- **Retrato de B no mês fechado:** o caso "o mês fechado a 120%…" grava um retrato de B no mesmo mês (A lê 120%, B lê 50%). O bloco de mutação novo que tira o `escolaId` de `orcamento-do-mes.repository.ts` aponta para esse caso.
- **Leitura não grava:** o caso novo compara `orcamento_ia_do_mes` antes e depois do `GET`.
- **Largura das barras:** `Governanca.test.tsx` confere o `width` de cada barra, e há um bloco de mutação para `valor={0}`.
- **Texto de `sem_retrato`:** a linha nova na `cenarios.md` §4 bate com `docs/interface.md:574` e com `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:113`. A recomendação antiga ("fixar em `docs/interface.md`") está atendida e foi tirada da tabela com razão.

Recomendações:
- `e2e/support/governanca.ts` (`passarDoPrevistoDeIa`): o `update` muda o custo da primeira linha de `consumo_ia` pela ordem do `id`, sem filtrar pelo mês corrente. Hoje funciona porque `montarEscolaComEntregas` grava tudo em `now()`. Se o suporte passar a gravar linha em mês fechado, o 120% some sem aviso claro. Vale filtrar `em` pelo mês corrente.
- `governanca.int.test.ts`, caso das duas linhas: a consulta que busca o `execucao_id` não filtra `estado`. Se existir uma linha de execução falhada mais recente, a busca pode pegar a execução errada. O resultado não muda, porque a chave estrangeira aceita qualquer execução de A, mas filtrar `estado = 'concluida'` deixa a intenção explícita.

## test-engineer · 3ª rodada · APROVADO · 2026-11-21 21:19:42 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: APROVADO

Esta é a 3ª rodada. Auditei o diff desde a rodada 1 (`.processo/ordens/diff-6-r2.patch`) e conferi as duas correções exigidas e as recomendações 3 a 7.

Rodei `Governanca.test.tsx`: 28 casos passaram. Não consegui rodar `governanca.int.test.ts` porque o compose de teste está ocupado por outra sessão (despachante e workers de pé). Não derrubei nada. Por isso, os números do caso de integração e os e2e foram conferidos pela leitura do código e do suporte, não por execução.

**Cenários exigidos:** os mesmos da rodada anterior, mais as duas correções:
- (1) uma execução com duas linhas pesa entrada e saída na `parte`, e conta uma execução só;
- (2) a 360 px e a 1366 px, o aviso e a porcentagem aparecem com texto num estado `definido` com aviso 100.

**Cobertos:**

1. **Correção 1, feita.**
   - O caso fica em `apps/api/src/governanca/governanca.int.test.ts:593-618`. Ele grava, no mês fechado 2020-10, a função conversa_e_ferramentas com uma execução de duas linhas, (500, 0) e (0, 500), e a função tutor_com_o_aluno com uma linha de entrada 3000. Depois espera `[{conversa_e_ferramentas, 25, 1}, {tutor_com_o_aluno, 75, 1}]` por `toEqual`.
   - O contrato não tem `refine` sobre a soma das partes: `parte` é só `int().min(0).max(100)`, em `packages/shared/src/governanca/governanca.ts:123`. Com a mutação do `tokensDoMes` (`6_task.md:138-143`, que cita este caso), o parse do serviço não lança. O serviço devolve 29 e 86, e o caso fica vermelho na asserção da `parte`, que é o motivo certo.
   - Sem a segunda linha, o Assistente daria 14. Sem o `count distinct`, daria 2 execuções.
   - O mês 2020-10 só é usado por este caso, e o `afterEach` apaga pelo `MODELO_DO_CASO`: o resultado não depende do que o mês corrente de A tiver.

2. **Correção 2, feita.**
   - `passarDoPrevistoDeIa` (`e2e/support/governanca.ts:228-247`) define R$ 1 por aluno e põe o custo do mês em 120%, por SQL. Ele lança erro se a escola não tiver aluno ativo ou consumo, o que evita um cenário vazio.
   - O Painel (`e2e/painel-da-coordenacao.spec.ts:64-67, 84-86`) afirma "IA do mês: 120% do previsto." e o aviso de 100% pelo `data-aviso="atencao"` do `Alert`, com `paginaNaoRola` e `seriousViolations`.
   - A Governança (`e2e/governanca.spec.ts:314-343`) afirma o mesmo e verifica que o aviso fica dentro da janela, sem texto cortado (`scrollWidth`), com `paginaNaoRola`.
   - Os dois rodam nos projetos `chromebook` (1366) e `celular` (360).
   - O roteiro (`e2e/roteiro-da-demonstracao.spec.ts:209-210`) agora espera o texto exato de `sem_orcamento`.
   - O estado `sem_orcamento` do Painel continua provado no caso da escola sem ano letivo (`painel-da-coordenacao.spec.ts:103`).

3. **Recomendações 3 a 7, aplicadas.**
   - A autoconferência 11 foi reescrita.
   - O caso do mês fechado ganhou um retrato de B no mesmo mês (A lê 120%, B lê 50%), com um bloco de mutação novo no `orcamento-do-mes.repository.ts`.
   - O tamanho de cada barra é afirmado pelo `width` 41%/59% em `Governanca.test.tsx:463-466`, com o bloco `valor={0}`.
   - O texto de `sem_retrato` está na `cenarios.md` §4, igual ao de `textos-da-governanca.ts:113` e ao de `docs/interface.md:574`.
   - O caso "a leitura da coordenação não grava o retrato…" compara `orcamento_ia_do_mes` antes e depois de três `GET` (A no mês corrente, A num mês fechado, e B).

4. **Tabela de testes:** as linhas novas ou alteradas (a `parte` com duas linhas, a leitura que não grava, o tamanho da barra, a 360 px a 120%) citam cada uma o seu caso pelo nome. Não há `.skip`, nem mock que esconda a regra, nem provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
- O bloco de mutação novo do `OrcamentoDoMesRepository` (`6_task.md`, `.where(eq(orcamentoIaDoMes.mes, ...))`) só fica vermelho se o primeiro retrato de 2020-03 que o seq scan devolve for o de B. A consulta pega `[linha]` sem `order by` (`packages/core/src/ia/orcamento-do-mes.repository.ts:226-235`). Hoje funciona porque B é inserido antes de A, mas isso depende da ordem física das linhas. Uma prova que não depende dela: um caso em que só B tem retrato num mês fechado, e A precisa ler `sem_retrato`. Fica para a validação e a retro.
- Em `painel-da-coordenacao.spec.ts:86`, `paginaNaoRola` substituiu `horizontalOverflow`. No projeto `chromebook` isso passa a exigir também que a página não role na vertical a 1366 × 768, o que é mais rigoroso. Não pude rodar o e2e: o Validador deve confirmar que o portão rodou esse caso nos dois projetos e dentro de metade do prazo.

Arquivos citados:
- apps/api/src/governanca/governanca.int.test.ts
- apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx
- e2e/support/governanca.ts
- e2e/painel-da-coordenacao.spec.ts
- e2e/governanca.spec.ts
- e2e/roteiro-da-demonstracao.spec.ts
- packages/core/src/ia/orcamento-do-mes.repository.ts
- tasks/prd-camada-ia/6_task.md
