# Cenários — Camada de IA

> Acompanha `techspec.md`. Cada linha diz o teste, a camada e a mutação que o derruba. Os nomes de arquivo são os
> prováveis; a tarefa fixa o caminho. Nenhum cenário chama provedor pago: principal e provedor de reserva são
> `FakeAdapter`s com `provedorId` distintos, ou um adaptador de teste que falha sob comando (5xx, prazo, conexão).
> `MODELOS_APROVADOS` é injetado no teste.

## 1. Por RF

### Reserva e soberania (RF1 a RF5)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF1 | Reserva sem suboperador vigente: o worker sobe, o principal passa, `ia.provedor_de_reserva.conferido = 0`; com o principal fora, a chamada termina `IA_INDISPONIVEL` sem chamar a reserva | integração, `apps/api/src/ia/reserva-na-subida.int.test.ts` | tirar a conferência da elegibilidade |
| RF1 | Variantes: `pais_fora_do_brasil`, `treinamento_nao_vedado`, suboperador encerrado (contrato vencido) e reinício: fora do caminho, o principal segue | idem | conferir só a existência do suboperador |
| RF1 | Reserva com `pais_fora_do_brasil` aprovada só para `relatorio_da_correcao` (envia `trabalho_do_aluno` sem `levaTextoDeAluno`), e outra só para `gerar_atividade_objetiva`: as duas não elegíveis | `soberania.test.ts` | exigir Brasil só com `levaTextoDeAluno` |
| RF1 | O cadastro corrigido, sem reiniciar (intervalo injetado): a chamada seguinte com o principal fora vai à reserva | idem | conferir uma vez só |
| RF2 | Controle negativo: reserva cobre só `material_da_escola`, aprovada para `gerar_atividade_objetiva` e `turno_do_tutor`: a subida recusa com `categoria_faltando:conversa_do_aluno` | unidade, `packages/core/src/ia/soberania.test.ts` | não exigir categoria |
| RF2 | Controle positivo: reserva cobre só `material_da_escola`, aprovada só para `gerar_atividade_objetiva`: conferida | idem | exigir as categorias de todas as tarefas do catálogo |
| RF2 | Aprovação só para `gerar_atividade_objetiva`, principal **fora**: a geração vai à reserva; o turno do Tutor termina indisponível sem chamar a reserva | unidade, `llm-gateway.test.ts` › "provedor de reserva" | elegibilidade sem o teste da tarefa |
| RF2 | O mesmo com o principal **sem vaga** (balde cheio, sem menor): a geração vai à reserva pelo ramo (1); o Tutor termina `IA_INDISPONIVEL`/`sem_vaga` sem chamar a reserva | idem | conferir a elegibilidade só no ramo da queda |
| RF4 | Tutor aprovado para `(reserva, modelo-x)`; `LLM_RESERVA_MODELO_RAPIDO` trocado para `modelo-y` e principal fora: indisponível, sem chamar a reserva; a regra fixa da D36 responde igual | `llm-gateway.test.ts`, `turno-do-tutor.test.ts` | conferir só o nome da tarefa na aprovação |
| RF4 | O mesmo para `classificar_secoes` | `llm-gateway.test.ts` | idem |
| RF4 | Aprovação para `(outro-provedor, modelo-x)`; reserva com `IA_RESERVA_PROVEDOR_ID` diferente e o mesmo `modelo-x`, principal fora: indisponível, sem chamar a reserva | `llm-gateway.test.ts` | comparar tarefa e modelo sem o `provedorId` |
| RF4 | `MODELOS_APROVADOS`: tarefa fora de `TAREFAS_DE_IA`, entrada sem `relatorio`, `sha256` ou `aprovadoPor`, ou `relatorio` inexistente quebram o teste da constante; a guarda recalcula o sha256 do `relatorio.md` e compara | unidade, `modelos-aprovados.test.ts` | hash qualquer; conferir só a presença do campo |
| RF4 | A função de elegibilidade com `ambiente = producao` recusa a entrada de `falso-reserva` e aceita a de outro provedor; com `local` e `staging`, aceita a do falso | unidade, `modelos-aprovados.test.ts` | aceitar o falso em produção |
| RF4 | A entrada de `falso-reserva` com `sha256` que não bate com o relatório sintético, ou com o relatório ausente, quebra o teste da constante | `modelos-aprovados.test.ts` | isentar a entrada do falso da guarda |
| RF4 | Subida, pela configuração real: `AMBIENTE=producao` com o adaptador falso na reserva, ou com `IA_RESERVA_PROVEDOR_ID=falso-reserva` sobre `openai_compat`, recusa citando a variável (como `MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO`); `IA_RESERVA_PROVEDOR_ID` igual ao `IA_PROVEDOR_ID` recusa em qualquer ambiente, com caso em `AMBIENTE=local` | `packages/core/src/config/llm-config.test.ts` | aceitar a falsa em produção; não comparar os dois ids; comparar só em produção |
| RF4 | A reserva falsa com `IA_RESERVA_PROVEDOR_ID=falso-reserva`: o balde, o rótulo `provedor` da medida e o disjuntor são os dela, diferentes dos do principal falso | `llm-gateway.test.ts` | identidade do falso fixa em `falso` |
| RF3 | Disjuntor do principal aberto: vai à reserva; a saída é a dela; `ia.degradacao{degrau="provedor_de_reserva"}` soma 1 | `llm-gateway.test.ts` | tirar o ramo da queda |
| RF3 | `IA_INDISPONIVEL` de servidor, e de conexão: vai à reserva | idem | tratar só o disjuntor como queda |
| RF3 | `IA_TEMPO_ESGOTADO` com o sinal vivo: vai à reserva; com o sinal **já abortado**: não vai | idem | tirar `!sinal.aborted` (o abortado), tirar o prazo da lista de quedas (o vivo) |
| RF3 | Com modelo menor disponível e reserva elegível, sem vaga no principal: vai ao menor, não à reserva | idem | reserva antes do menor |
| RF3 | O 429 que sobra da repetição: tratado como sem vaga (menor, depois reserva) | idem | tratar o 429 como queda |
| RF3 | Sem vaga no principal: o provedor de reserva usa o balde dele; sem vaga também ali: `IA_INDISPONIVEL`, `sem_vaga` | `llm-gateway.test.ts`, `token-limiter` falso | usar o balde do principal |
| RF3 | A reserva é tentada uma vez: principal fora e reserva fora, uma chamada a ela; no interativo, indisponível; no lote, `JobAdiadoError(provedor)` | `llm-gateway.test.ts`, `fila-de-ia.int.test.ts` | laço de volta ao principal |
| RF3 | No máximo quatro chamadas: principal inválido duas vezes não vai à reserva (saída inválida não é queda); principal com 5xx e reserva inválida duas vezes: três linhas (a estimada do principal e as duas da reserva), termina `IA_SAIDA_INVALIDA` | idem | repetir sem limite |
| RF3 | A saída inválida da reserva repete **na reserva** (a segunda chamada tem o `provedorId` dela) | idem | repetir no principal |
| RF3 | "Provedor de IA fora" com os dois fora: a regra tem rótulo `provedor` e dispara para cada um | `infra/test/alertas.test.ts` | rótulo fixo |
| RF3 | A variante sem reserva do teste do "degrau 3" (`llm-gateway.test.ts`, por volta da linha 995) segue igual à da X6 | idem | — |
| RF5 | Primeira saída inválida e a segunda válida: duas linhas, a primeira `falhou`/`IA_SAIDA_INVALIDA`, cada uma com os seus tokens e custo; `entrada` e `saida` só na segunda | integração, `apps/api/src/ia/ia.int.test.ts` | uma linha por execução |
| RF5 | Troca para o menor: duas linhas, cada uma com o seu modelo e o seu preço | idem | gravar o modelo do perfil |
| RF5 | Principal com prazo esgotado, reserva atende: a linha do principal tem a estimativa (entrada contada, saída no teto, preço do principal; custo > 0); a da reserva, o uso real e `pelo_provedor_de_reserva = true` | idem | custo zero na linha que caiu |
| RF5 | Chamada pela reserva: o compartilhamento do aluno lista o suboperador da reserva | `apps/api/test/arquivo-do-titular.int.test.ts` | gravar o provedor do principal |
| RF5 | Interrompida pela **varredura** (worker morto, 300 s) de tarefa aprovada para o provedor de reserva configurado, com preços diferentes no principal (1.300/5.200) e na reserva (2.000/8.000): estimada do principal **e** a dele, cada uma com os dois tetos ao seu preço; o compartilhamento do aluno lista as duas | `apps/api/test/arquivo-do-titular.int.test.ts`, `consumo.test.ts` | estimada só no destino do principal |
| RF5 | O mesmo pela **reentrega** do job (o job volta e acha a execução `rodando`, `#aoReentregar`): as duas estimadas; o compartilhamento lista as duas | `apps/api/src/ia/fila-de-ia.int.test.ts`, `arquivo-do-titular.int.test.ts` | estimada da reserva só na varredura |
| RF5 | Aprovação `(tarefa, provedor da reserva, modelo-x)` e a reserva configurada com `modelo-y`: a interrompida grava as duas estimadas mesmo assim (destino superestimado, D14); o compartilhamento lista as duas | `consumo.test.ts`, `arquivo-do-titular.int.test.ts` | comparar também o modelo |
| RF5 | Aprovação para a tarefa com **outro** `provedorId`, e a reserva configurada com o seu: a interrompida grava só a estimada do principal; o compartilhamento lista só o principal | `consumo.test.ts`, `arquivo-do-titular.int.test.ts` | comparar sem o `provedorId` |
| RF5 | Interrompida de tarefa sem aprovação para a reserva: só a do principal | idem | estimada da reserva sempre |
| RF5 | Governança com uma execução de duas linhas: `execucoes = 1` | `governanca.int.test.ts` | `count(*)` |

### Custo e orçamento (RF6 a RF10)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF6 | 3.000 + 250 tokens, 1.300 e 5.200 micros por mil: 5.200; 1.001 + 1 tokens: arredonda para cima | unidade, `consumo.test.ts` | `round` no lugar de `ceil` |
| RF6 | Duas vigências do mesmo modelo: a chamada antes e a depois gravam cada uma o seu preço; o mês soma as duas; a linha antiga não muda depois da troca | `consumo.test.ts`, `orcamento-do-mes.repository.int.test.ts` | usar sempre o último preço; recalcular na leitura |
| RF6 | Mesmo modelo em dois provedores a preços diferentes: cada um no seu | `consumo.test.ts` | chave do preço só pelo modelo |
| RF6 | `AMBIENTE=producao`, `openai_compat`: modelo do principal sem preço, `LLM_RESERVA_MODELO` sem preço, `LLM_RESERVA_MODELO_<PERFIL>` sem preço: cada um recusa a subida citando a variável | `llm-config.test.ts`/`llm-gateway.test.ts` | exigir preço só do principal |
| RF6 | A interrompida grava uma linha por destino, cada uma com os **dois tetos** da tarefa ao preço do seu modelo (preços diferentes nos dois), custo > 0; a chamada que caiu grava a entrada contada e a saída no teto | `consumo.test.ts` | custo zero na estimada; preço do principal na linha da reserva; entrada contada na interrompida |
| RF7 | Escola sem valor, rede com R$ 5: vale a rede, `origemDoValor = rede`; escola com R$ 3: vale 3; escola com teto próprio e sem valor: valor da rede, teto da escola | unidade, `orcamento-de-ia.test.ts`; integração, `painel-escrita.int.test.ts` | inverter a precedência; precedência por linha, não por coluna |
| RF7 | `PUT` da escola: auditoria `escola.orcamento_ia_alterado` com `antes`, `depois` e o operador; o mesmo `PUT` de novo: nenhuma auditoria nova | `painel-escrita.int.test.ts` | não auditar; `antes = depois` na gravação; auditar sempre |
| RF7 | `PUT` da rede: `rede.orcamento_ia_alterado` com `escola_id` nulo; o mesmo `PUT` de novo: nenhuma auditoria nova; `GET /v1/operacao/redes` traz `escolasQueUsamOValorDaRede` certo: conta a escola com valor próprio e teto da rede, e a com teto próprio e valor da rede; não conta a com os dois próprios; uma escola da rede 2 que usa o valor da rede 2 não conta na rede 1 (as duas contagens conferidas) | `painel-escrita.int.test.ts`, `painel-leitura.int.test.ts` | auditar sempre na rede; contar todas as escolas da rede; contar só pelo valor; contar sem o filtro da rede |
| RF7 | Validação: valor 0, R$ 100,01, teto 99, teto 1001 → `VALIDACAO`; R$ 0,01, R$ 100,00, 100 e 1000 passam; valor nulo volta à rede; 500 centavos gravam 5.000.000 micros | `painel-escrita.int.test.ts`, `packages/shared/src/operacao/painel.test.ts` | fator de conversão; limite aberto |
| RF7 | 429 no `PUT` pelo limitador do operador | `painel-escrita.int.test.ts` | — |
| RF7 | Id de escola ou rede inexistente: `NAO_ENCONTRADO`, mesmo corpo de rota inexistente | `operacao-isolamento.int.test.ts` | — |
| RF7 | A primeira gravação numa escola sem linha em `configuracao_operacional_escola` cria a linha | `painel-escrita.int.test.ts` | `update` sem garantir a linha |
| RF7 | Escola sem ano letivo `em_curso` (montagem): o `PUT` grava, audita e devolve o orçamento vigente | `painel-escrita.int.test.ts` | exigir ano letivo no contexto do `PUT` |
| RF8 | 100 alunos ativos, R$ 5, R$ 400 no mês civil de São Paulo: 80%; a chamada de 31/03 23h30 (UTC-3) conta em março | `orcamento-de-ia.test.ts`, `orcamento-do-mes.repository.int.test.ts` | somar pelo mês em UTC |
| RF8 | Alunos ativos: vínculo encerrado não conta; o que chegou hoje conta; vínculo não encerrado do ano anterior não conta; aluno em duas turmas do ano conta uma vez; sem ano `em_curso`, zero | `orcamento-do-mes.repository.int.test.ts` | tirar o filtro de vínculo encerrado; tirar `ano.situacao = 'em_curso'`; tirar o `distinct` |
| RF8 | "Hoje": a chamada de 23h30 de São Paulo conta no dia certo (relógio falso) | idem | dia em UTC |
| RF8 | Retrato: a medida grava o do mês corrente de São Paulo (às 21h30 do último dia, o mês que acaba, não o seguinte); regravar não duplica; o mês fechado mostra o último retrato, com o número de alunos e o valor dele, mesmo depois de o valor mudar | `apps/worker/test/orcamento-gauge.int.test.ts`, `orcamento-do-mes.repository.int.test.ts` | ler o mês fechado com o valor e os alunos de hoje |
| RF9 | API: a 79% `aviso = null`; a 80% exatos, `80`; a 100%, `100`; no mês seguinte, `null`; `?mes=` de mês fechado a 120%: `null` | `governanca.int.test.ts` | `>=` trocado por `>`; aviso sem o mês |
| RF9 | A medida publica 0,79 → 0,81 → 1,02 para a escola certa | `orcamento-gauge.int.test.ts` | somar o mês em UTC; misturar escolas |
| RF9 | Os alertas de 80% e 100% e o de `uso_do_teto` têm a expressão e o parágrafo do runbook (o do teto cita "Classificação do material atrasada"); o de `ia.provedor_de_reserva.conferido` dispara com 0 por 10 min | `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts` | — |
| RF9 | Worker sem `LLM_RESERVA_BASE_URL` nem `IA_RESERVA_PROVEDOR_ID`: a série `ia.provedor_de_reserva.conferido` não é publicada e o alerta não dispara; com a reserva configurada e recusada, publica 0 e dispara em 10 min | `apps/worker/test/` (a medida da conferência), `infra/test/alertas.test.ts` | série publicada com 0 sem reserva; alerta por `absent()` |
| RF9 | Acima de 100%, o turno do Tutor e a ferramenta (`interativa`, `ferramenta`, `normal`) são atendidos | `apps/api/src/ia/orcamento-teto.int.test.ts` | conferir o teto em toda fila |
| RF10 | Teto 200%: no limite exato, o lote segue; um micro acima, volta a `pendente` com `JobAdiadoError(orcamento)`, sem tentativa, e `ia.lote.adiado{motivo="orcamento"}` soma 1 | idem | `>` trocado por `>=`; contar tentativa |
| RF10 | Às 23h50 do último dia (relógio falso): `tenteDeNovoEmSegundos = 600`; no meio do mês, 3.600 | `orcamento-de-ia.test.ts` | sem o `mín` |
| RF10 | Na virada do mês, o lote adiado volta a rodar; com o teto subido pela Operação, também | `orcamento-teto.int.test.ts` | — |
| RF10 | Escola `sem_orcamento` ou `sem_aluno_ativo`: o lote nunca é adiado pelo teto | idem | orçamento zero como teto zero |

### O que cada um vê (RF11 e RF12)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF11 | `GET /v1/operacao/uso` com o grupo `ia`: contrato estrito sem campo de pessoa; `ordem=custo` põe a de maior custo do mês primeiro; `chamadasPeloProvedorDeReserva` conta linhas, `execucoes` conta execuções | `painel-leitura.int.test.ts`, `apps/api/test/contracts.test.ts` | ordenar por nome; contar execuções nas chamadas |
| RF11 | Escola sem ano em curso: `situacao = sem_aluno_ativo`, `porcentagem` nula, reais visíveis; sem valor nem na rede: `sem_orcamento`, `origemDoValor = nenhuma`, reais visíveis | idem | porcentagem com divisor zero |
| RF11 | `uso()` com A e B da §2: cada linha traz a porcentagem e os alunos ativos da própria escola (A 20%, 100 alunos; B 111%, 900 alunos); a chamada de A no último dia às 23h30 de São Paulo conta no mês; o vínculo não encerrado do ano anterior não conta; um aluno de A em duas turmas do ano conta uma vez (A segue com 100); o "agora" entra como parâmetro (relógio falso), não pelo `now()` do Postgres | `painel-leitura.int.test.ts` | somar o mês em UTC; vínculos sem a escola; contagem sem `distinct`; usar o `now()` do Postgres |
| RF11 | `GET …/escolas/:id/uso-ia`: 12 meses, cada um com o retrato dele; mês sem retrato: `sem_retrato`; retrato com zero aluno: `sem_aluno_ativo`; id inexistente: `NAO_ENCONTRADO` | `painel-leitura.int.test.ts` | os 12 meses com o valor de hoje; divisão por zero |
| RF11 | `GET /v1/operacao/redes` e `/escolas` trazem o orçamento próprio e o vigente | idem | — |
| RF12 | `GET /v1/governanca/consumo`: o schema estrito recusa `tokens*` e `custoMicros`; `parte` soma 100 (± arredondamento); zero token no mês: `parte = 0` em todas, sem divisão por zero; sem ano em curso e sem orçamento: sem porcentagem e sem aviso | `governanca.int.test.ts`, `packages/shared/src/governanca/governanca.test.ts` | devolver `custoMicros` |
| RF12 | Professor e aluno em `governanca/consumo` e nas rotas da Operação: 404 | `governanca.int.test.ts`, `operacao-isolamento.int.test.ts` | — |
| RF12 | A auditoria de orçamento não aparece na leitura de auditoria da coordenação | `governanca.int.test.ts` | — |
| RF12 | Os textos da coordenação (Painel e Governança) não têm "R$", "token" nem "crédito" | `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts` | — |

### Avaliação (RF13 a RF16)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF13–16 | A ferramenta recusa rodar sem `AVALIACAO_*`; o relatório grava o sha256 do arquivo de amostras lido; não importa nada de teste; nenhum teste a executa contra rede | unidade, `tools/ia/avaliar-modelos.test.ts` | rodar sem a variável; sha256 de outro arquivo |
| RF13 | `tools/ia/amostras/` não tem amostra que peça correção, nota ou devolutiva de discursiva ou redação (D55) | `tools/guardas/` (guarda nova) | — |

## 2. Isolamento

Escolas A e B em **redes diferentes** (rede 1 e rede 2), no mesmo mês, com tudo próprio e diferente. Cada cenário
confere **as duas** escolas, para que uma leitura sem escopo, que devolve a mesma linha às duas, erre pelo menos uma:

- A: 100 alunos ativos, R$ 5 por aluno, teto 200%, R$ 100 gastos → orçamento R$ 500, **20%**, abaixo do teto (R$ 1.000)
- B: 900 alunos ativos, R$ 1 por aluno, teto 100%, R$ 1.000 gastos → orçamento R$ 900, **111%**, acima do teto (R$ 900)

| Leitura | O que se confere | Mutação que o derruba |
|---|---|---|
| Soma do mês | a coordenação de A lê 20% e a de B 111%; o lote de A segue e o de B é adiado | tirar `eq(consumoIa.escolaId, …)` (A soma R$ 1.100: 220%, adiada) |
| Alunos ativos | idem | tirar a cláusula de escola da contagem de vínculos (A com 1.000 alunos: 2%) |
| Configuração (variante 1) | valor e teto próprios nas duas escolas, e valores diferentes nas redes (R$ 9 e R$ 2) que não podem aparecer: A 20%, B 111% | tirar a cláusula de escola da configuração |
| Rede (variante 2) | as escolas sem valor próprio; a rede 1 com R$ 5 e teto 200%, a rede 2 com R$ 1 e teto 100%: A 20%, B 111% | ler a rede sem partir da escola do contexto |
| `PUT` da escola | o `PUT` em A não muda a configuração nem o orçamento vigente de B | `update` sem `where` da escola |
| `PUT` da rede | o `PUT` na rede 1 não muda a rede 2 nem o orçamento vigente de B (variante 2) | `update` da rede sem `where` do id |
| Operação | a sessão de coordenação em todas as rotas `@OperacaoRoute` (`ROTAS_DO_PAINEL` inclui `GET …/escolas/:id/uso-ia` e os dois `PUT`): 404, com o corpo do id inexistente | — (a varredura existente) |
| Meses, retrato | B com retrato num mês em que A não tem: esse mês de A é `sem_retrato`, e a lista tem exatamente 12 itens | tirar `eq(escola_id)` da leitura do retrato |
| Meses, consumo | B com consumo nos mesmos meses de A, com valores diferentes: os 12 meses de A trazem só o custo de A | tirar `eq(escola_id)` da soma dos meses |
| Exceções declaradas | `architecture.test.ts`: o `OrcamentoDaRedeRepository` tem exatamente um método `@Unscoped`, com a justificativa "acima do tenant"; o `OrcamentoDoMesRepository`, nenhum | um segundo método marcado; marcar o do mês |

## 3. Corrida

Estado inicial: a escola **sem** linha em `configuracao_operacional_escola` (o painel não a cria).

| Trava | Ordem forçada | O que se espera | O que a deixa vermelha |
|---|---|---|---|
| Dois `PUT` da escola com valores diferentes | o primeiro segura a linha (`WriteBlockTrigger`) depois do `for update`; o segundo chega e espera | vale o segundo; duas auditorias; o `antes` da segunda é o `depois` da primeira; nenhum 500 | ler o `antes` sem `for update`, ou antes de garantir a linha; tirar o `on conflict do nothing` (o segundo cai com 23505) |
| Dois `PUT` da escola com o mesmo valor | idem | uma auditoria só (a segunda vê `antes = depois`) | ler o `antes` fora da trava |
| Dois `PUT` da rede com valores diferentes | idem, na linha da rede | vale o segundo; duas auditorias; o `antes` da segunda é o `depois` da primeira | ler o `antes` sem `for update` |
| Dois `PUT` da rede com o mesmo valor | idem | uma auditoria só | auditar sempre; ler o `antes` fora da trava |
| Retrato regravado por duas réplicas da medida | `esperarNaTrava` na primeira | uma linha por (escola, mês) | `insert` sem `on conflict` |

## 4. Telas

Textos a fixar em `docs/interface.md` 5 na tarefa da tela. Os da coordenação seguem a D40: nada é cortado, e sem
"crédito", "R$" ou "token".

- **Coordenação, Painel e Governança:**
  - `definido`: "IA do mês: 62% do previsto."
  - aviso de 80: "A escola já usou 80% do previsto para a IA neste mês. Nada é cortado."
  - aviso de 100: "A escola passou do previsto para a IA neste mês. Nada é cortado, e a equipe Turmma vai conversar
    com vocês se isso se repetir."
  - `sem_orcamento`: "O previsto de IA da escola ainda não foi definido. A equipe Turmma define com vocês."
  - `sem_aluno_ativo`: "A porcentagem aparece quando a escola tiver aluno ativo."
- **Governança, por função:** "Assistente de ensino: 41% do que a IA trabalhou no mês · 128 execuções".
- **Operação, Uso:**
  - o grupo "IA" tem o título "IA (hoje, até agora, e mês)"; a infra segue "último dia fechado", e a tela diz;
  - célula sem orçamento: "sem orçamento definido", com a ação "Definir orçamento" (abre o diálogo);
  - escola sem aluno: "sem aluno ativo";
  - vazio (nenhuma escola): "Nenhuma escola criada ainda.";
  - "Ver meses" abre a lista dos 12 meses; vazio: "Ainda não há mês fechado com retrato."; mês sem retrato: "sem
    retrato (antes da medição)".
- **Operação, diálogo "Orçamento de IA":**
  - "Valor por aluno por mês (R$)", "Teto de segurança (% do orçamento)", e a caixa "Usar o valor da rede";
  - "Vale hoje: R$ 5,00 por aluno, da rede.";
  - antes de salvar: "Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%." e, na rede, "Muda o
    orçamento de 3 escolas que usam o valor da rede.";
  - o botão "Salvar orçamento"; o resultado: "Orçamento salvo."; o 429 diz em quantos minutos tentar de novo;
  - valor fora do intervalo: "Use um valor entre R$ 0,01 e R$ 100,00." / "Use de 100% a 1000%."
- **Erro** de toda tela: "Não foi possível carregar. Tentar de novo"; a web antiga com a API nova: "Atualize a página".

Estados de toda tela: carregando, vazio, erro, com dado. R$ com vírgula; datas em pt-BR.

**Celular e acessibilidade:** sem rolagem horizontal a partir de 360 px no Uso (cartão), no diálogo, em "Ver meses", no
Painel e na Governança; alvo de 24 px, 44 px em "Salvar orçamento"; nada só por hover. No diálogo: rótulo por campo,
erro ligado ao campo (`aria-describedby`) e anunciado (`role=alert`), foco devolvido ao gatilho ao fechar. Aviso e
porcentagem com texto, não só cor.

E2E (casos novos, nos projetos `computador` e `celular`, com fotos `chromebook` e `celular` das quatro telas):
`e2e/operacao-uso.spec.ts`, `e2e/operacao-escolas.spec.ts` (o diálogo, com a confirmação, o erro anunciado e o foco),
`e2e/painel-da-coordenacao.spec.ts` e `e2e/governanca.spec.ts`.

## 5. Carga

A fase `reserva` do `carga.ts`, com `LLM_RESERVA_TOKENS_POR_MINUTO` de `infra/carga.env`. A fase `sala` roda com a
reserva desligada, para continuar comparável à X6.

- **Queda por servidor:** a meio da fase, o principal falso responde 5xx em 100% (`IA_FALHA_FALSA=principal:5xx`), e a
  reserva falsa atende. Passa com zero indisponível para o aluno, o p95 do turno do Tutor até 1 s acima do da fase
  `sala`, e `ia.degradacao{degrau="provedor_de_reserva"}` subindo.
- **Queda por prazo:** `IA_FALHA_FALSA=principal:prazo`. Passa com indisponível só quando o prazo da execução já
se esgotou antes da reserva, sempre `IA_TEMPO_ESGOTADO` tipado e nunca erro cru; o número fica no relatório da fase.
- **Balde cheio no pico:** o balde do principal no limite, e o transbordo vai à reserva sem indisponível.
- **Identidade:** a carga roda com `AMBIENTE=local`, como hoje. A reserva falsa liga com `IA_RESERVA_PROVEDOR_ID=falso-reserva`,
  id diferente do principal, com balde, rótulo e disjuntor próprios, e a entrada sintética dela em `MODELOS_APROVADOS`
  vale fora de produção. `IA_FALHA_FALSA` só tem efeito no `FakeAdapter`.
- **Controle negativo:** a mesma fase com `IA_RESERVA_PROVEDOR_ID=falso-sem-aprovacao` (id sem entrada) reprova pelo
  critério: o worker sobe, a reserva fica não elegível, e há indisponível acima de zero na janela da queda.
