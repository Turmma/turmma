# Cenários — Camada de IA

> Acompanha `techspec.md`. Cada linha diz o teste, a camada e a mutação que o derruba. Os nomes de arquivo são os
> prováveis; a tarefa fixa o caminho. Nenhum cenário chama provedor pago: principal e provedor de reserva são
> `FakeAdapter`s com `provedorId` distintos, ou um adaptador de teste que falha sob comando (5xx, prazo, conexão).
> `MODELOS_APROVADOS` é injetado no teste.
>
> **Corte de 21/11/2026 (Joaquim):** os cenários da reserva (RF1 a RF4, a parte da reserva do RF5, do RF6 e do RF9), da
> avaliação (RF13 a RF16) e da carga (§5) foram para a F5b, `tasks/prd-reserva-e-avaliacao/cenarios.md`, sem mudança.

## 1. Por RF

### Custo por chamada (RF5)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF5 | Primeira saída inválida e a segunda válida: duas linhas, a primeira `falhou`/`IA_SAIDA_INVALIDA`, cada uma com os seus tokens e custo; `entrada` e `saida` só na segunda | integração, `apps/api/src/ia/ia.int.test.ts` | uma linha por execução |
| RF5 | Troca para o menor: duas linhas, cada uma com o seu modelo e o seu preço | idem | gravar o modelo do perfil |
| RF5 | Governança com uma execução de duas linhas: `execucoes = 1`; duas linhas sem execução: `execucoes = 2` | `governanca.int.test.ts` | `count(*)`; tirar a linha sem execução da conta |
| RF5 | A chamada que não saiu não é chamada: com o disjuntor aberto ou sem vaga **no lote**, nenhuma linha, e o job adia; **fora do lote**, uma linha da falha com `tentativas = 0`, sem tokens, custo nem envio; e a chamada anterior que saiu mantém a sua linha mesmo com a repetição adiada | `llm-gateway.test.ts` | gravar a linha no lote; não gravar fora do lote |

### Custo e orçamento (RF6 a RF10)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF6 | 3.000 + 250 tokens, 1.300 e 5.200 micros por mil: 5.200; 1.001 + 1 tokens: arredonda para cima | unidade, `consumo.test.ts` | `round` no lugar de `ceil` |
| RF6 | Duas vigências do mesmo modelo: a chamada antes e a depois gravam cada uma o seu preço; o mês soma as duas; a linha antiga não muda depois da troca | `consumo.test.ts`, `orcamento-do-mes.repository.int.test.ts` | usar sempre o último preço; recalcular na leitura |
| RF6 | Mesmo modelo em dois provedores a preços diferentes: cada um no seu | `consumo.test.ts` | chave do preço só pelo modelo |
| RF6 | `AMBIENTE=producao`, `openai_compat`: modelo do principal sem preço (`LLM_MODELO`, `LLM_MODELO_<PERFIL>`) recusa a subida citando a variável (o da reserva é da F5b) | `llm-config.test.ts`/`llm-gateway.test.ts` | não exigir preço |
| RF6 | A chamada que caiu depois do envio grava a entrada contada e a saída no teto, com custo > 0 (o custo da interrompida, uma linha por destino, é da F5b) | `consumo.test.ts`, `ia.int.test.ts` | custo zero na estimada |
| RF7 | Escola sem valor, rede com R$ 5: vale a rede, `origemDoValor = rede`; escola com R$ 3: vale 3; escola com teto próprio e sem valor: valor da rede, teto da escola | unidade, `orcamento-de-ia.test.ts`; integração, `painel-escrita.int.test.ts` | inverter a precedência; precedência por linha, não por coluna |
| RF7 | `PUT` da escola: auditoria `escola.orcamento_ia_alterado` com `antes`, `depois` e o operador; o mesmo `PUT` de novo: nenhuma auditoria nova | `painel-escrita.int.test.ts` | não auditar; `antes = depois` na gravação; auditar sempre |
| RF7 | `PUT` da rede: `rede.orcamento_ia_alterado` com `escola_id` nulo; o mesmo `PUT` de novo: nenhuma auditoria nova; `GET /v1/operacao/redes` traz `escolasQueUsamOValorDaRede` certo: conta a escola com valor próprio e teto da rede, e a com teto próprio e valor da rede; não conta a com os dois próprios; uma escola da rede 2 que usa o valor da rede 2 não conta na rede 1 (as duas contagens conferidas) | `painel-escrita.int.test.ts`, `painel-leitura.int.test.ts` | auditar sempre na rede; contar todas as escolas da rede; contar só pelo valor; contar sem o filtro da rede |
| RF7 | Validação: valor 0, R$ 100,01, teto 99, teto 1001 → `400 ENTRADA_INVALIDA` (o código de corpo recusado do painel; `VALIDACAO` não existe); R$ 0,01, R$ 100,00, 100 e 1000 passam; valor nulo volta à rede; 500 centavos gravam 5.000.000 micros | `painel-escrita.int.test.ts`, `packages/shared/src/operacao/painel.test.ts` | fator de conversão; limite aberto |
| RF7 | 429 no `PUT` pelo limitador do operador | `painel-escrita.int.test.ts` | — |
| RF7 | Id de escola ou rede inexistente: `NAO_ENCONTRADO`, mesmo corpo de rota inexistente | `painel-escrita.int.test.ts` | — |
| RF7 | A primeira gravação numa escola sem linha em `configuracao_operacional_escola` cria a linha | `painel-escrita.int.test.ts` | `update` sem garantir a linha |
| RF7 | Escola sem ano letivo `em_curso` (montagem): o `PUT` grava, audita e devolve o orçamento vigente | `painel-escrita.int.test.ts` | exigir ano letivo no contexto do `PUT` |
| RF8 | 100 alunos ativos, R$ 5, R$ 400 no mês civil de São Paulo: 80%; a chamada de 31/03 23h30 (UTC-3) conta em março | `orcamento-de-ia.test.ts`, `orcamento-do-mes.repository.int.test.ts` | somar pelo mês em UTC |
| RF8 | Alunos ativos: vínculo encerrado não conta; o que chegou hoje conta; vínculo não encerrado do ano anterior não conta; aluno em duas turmas do ano conta uma vez; sem ano `em_curso`, zero | `orcamento-do-mes.repository.int.test.ts` | tirar o filtro de vínculo encerrado; tirar `ano.situacao = 'em_curso'`; tirar o `distinct` |
| RF8 | "Hoje": a chamada de 23h30 de São Paulo conta no dia certo (relógio falso) | idem | dia em UTC |
| RF8 | Retrato: a medida grava o do mês corrente de São Paulo (às 21h30 do último dia, o mês que acaba, não o seguinte); regravar não duplica; o mês fechado mostra o último retrato, com o número de alunos e o valor dele, mesmo depois de o valor mudar | `apps/worker/test/orcamento-gauge.int.test.ts`, `orcamento-do-mes.repository.int.test.ts` | ler o mês fechado com o valor e os alunos de hoje |
| RF9 | API: a 79% `aviso = null`; a 80% exatos, `80`; a 100%, `100`; no mês seguinte, `null`; `?mes=` de mês fechado a 120%: `null` | `governanca.int.test.ts` | `>=` trocado por `>`; aviso sem o mês |
| RF9 | A medida publica 0,79 → 0,81 → 1,02 para a escola certa | `orcamento-gauge.int.test.ts` | somar o mês em UTC; misturar escolas |
| RF9 | Os alertas de 80% e 100% e o de `uso_do_teto` têm a expressão e o parágrafo do runbook (o do teto cita "Classificação do material atrasada"); o da reserva é da F5b | `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts` | — |
| RF9 | Acima de 100%, o turno do Tutor e a ferramenta (`interativa`, `ferramenta`, `normal`) são atendidos | `apps/api/src/ia/orcamento-teto.int.test.ts` | conferir o teto em toda fila |
| RF10 | Teto 200%: no limite exato, o lote segue; um micro acima, volta a `pendente` com `JobAdiadoError(orcamento)`, sem tentativa, e `ia.lote.adiado{motivo="orcamento"}` soma 1 | idem | `>` trocado por `>=`; contar tentativa |
| RF10 | `ia.lote.adiado{motivo}` soma o adiamento do lote em cada motivo (`orcamento`, `provedor` e `janela`); o código do teto numa ferramenta termina a execução como `falhou`, sem adiar o job | `orcamento-teto.int.test.ts`, `ia.int.test.ts` | contar só `orcamento`; adiar por código em qualquer fila |
| RF10 | Às 23h50 do último dia (relógio falso): `tenteDeNovoEmSegundos = 600`; no meio do mês, 3.600 | `orcamento-teto.int.test.ts` (a espera pelo processador), `apps/api/src/ia/orcamento.repository.test.ts` (a conta da virada) | sem o `mín` |
| RF10 | Na virada do mês, o lote adiado volta a rodar; com o teto subido pela Operação, também | `orcamento-teto.int.test.ts` | — |
| RF10 | Escola `sem_orcamento` ou `sem_aluno_ativo`: o lote nunca é adiado pelo teto | idem | orçamento zero como teto zero |

### O que cada um vê (RF11 e RF12)

| RF | Cenário | Camada e arquivo | Mutação que o derruba |
|---|---|---|---|
| RF11 | `GET /v1/operacao/uso` com o grupo `ia`: contrato estrito sem campo de pessoa; `ordem=custo` põe a de maior custo do mês primeiro; `chamadasPeloProvedorDeReserva` conta linhas, `execucoes` conta execuções | `painel-leitura.int.test.ts`, `apps/api/test/contracts.test.ts` | ordenar por nome; contar execuções nas chamadas |
| RF11 | `?ordem=custo` só no uso: `GET /v1/operacao/escolas?ordem=custo` responde `400 ENTRADA_INVALIDA`; o `uso()` ordena pelo custo do mês corrente de São Paulo (o de março e o de maio não entram) | `painel-leitura.int.test.ts`, `packages/shared/src/operacao/painel.test.ts` | dar `custo` à aba Escolas; somar o mês em UTC |
| RF11 | Escola sem ano em curso: `situacao = sem_aluno_ativo`, `porcentagem` nula, reais visíveis; sem valor nem na rede: `sem_orcamento`, `origemDoValor = nenhuma`, reais visíveis | idem | porcentagem com divisor zero |
| RF11 | `uso()` com A e B da §2: cada linha traz a porcentagem e os alunos ativos da própria escola (A 20%, 100 alunos; B 111%, 900 alunos); a chamada de A no último dia às 23h30 de São Paulo conta no mês; o vínculo não encerrado do ano anterior não conta; um aluno de A em duas turmas do ano conta uma vez (A segue com 100); o "agora" entra como parâmetro (relógio falso), não pelo `now()` do Postgres | `painel-leitura.int.test.ts` | somar o mês em UTC; vínculos sem a escola; contagem sem `distinct`; usar o `now()` do Postgres |
| RF11 | `GET …/escolas/:id/uso-ia`: 12 meses, cada um com o retrato dele; mês sem retrato: `sem_retrato`; retrato com zero aluno: `sem_aluno_ativo`; id inexistente: `NAO_ENCONTRADO` | `painel-leitura.int.test.ts` | os 12 meses com o valor de hoje; divisão por zero |
| RF11 | `GET /v1/operacao/redes` e `/escolas` trazem o orçamento próprio e o vigente | idem | — |
| RF12 | `GET /v1/governanca/consumo`: o schema estrito recusa `tokens*` e `custoMicros`; `parte` soma 100 (± arredondamento); zero token no mês: `parte = 0` em todas, sem divisão por zero; sem ano em curso e sem orçamento: sem porcentagem e sem aviso | `governanca.int.test.ts`, `packages/shared/src/governanca/governanca.test.ts` | devolver `custoMicros` |
| RF12 | Professor e aluno em `governanca/consumo` e nas rotas da Operação: 404 | `governanca.int.test.ts`, `operacao-isolamento.int.test.ts` | — |
| RF12 | A auditoria de orçamento não aparece na leitura de auditoria da coordenação | `governanca.int.test.ts` | — |
| RF12 | Os textos da coordenação (Painel e Governança) não têm "R$", "token" nem "crédito" | `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts` | — |

A avaliação (RF13 a RF16) foi para a F5b.

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
  - `sem_retrato` (o `?mes=` de um mês que fechou antes de a medição existir): "Este mês fechou antes de o previsto de IA ser medido, por isso não há porcentagem."
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
- **Erro** de toda tela: "Não foi possível carregar. Tentar de novo"; a web antiga com a API nova (`RespostaForaDoContrato`): "Atualize a página", sem "Tentar de novo", que traria a mesma resposta.

Estados de toda tela: carregando, vazio, erro, com dado. R$ com vírgula; datas em pt-BR.

**Celular e acessibilidade:** sem rolagem horizontal a partir de 360 px no Uso (cartão), no diálogo, em "Ver meses", no
Painel e na Governança; alvo de 24 px, 44 px em "Salvar orçamento"; nada só por hover. No diálogo: rótulo por campo,
erro ligado ao campo (`aria-describedby`) e anunciado (`role=alert`), foco devolvido ao gatilho ao fechar. Aviso e
porcentagem com texto, não só cor.

E2E (casos novos, nos projetos `computador` e `celular`, com fotos `chromebook` e `celular` das quatro telas):
`e2e/operacao-uso.spec.ts`, `e2e/operacao-escolas.spec.ts` (o diálogo, com a confirmação, o erro anunciado e o foco),
`e2e/painel-da-coordenacao.spec.ts` e `e2e/governanca.spec.ts`.

## 5. Carga

Sem fase nova na F5a: a fase `reserva` do `carga.ts` foi para a F5b (`cenarios.md` §5 de lá).
