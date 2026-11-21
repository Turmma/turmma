# Tech Spec — Camada de IA

**PRD:** `tasks/prd-camada-ia/prd.md`
**Status:** rascunho

## 1. Resumo da abordagem

Sem módulo novo: a F5 estende o `LLMGateway` e a montagem do `main-worker` (X6). O preço fica no código, em
`PRECO_DOS_MODELOS` (Joaquim, 20/11/2026). O gateway grava **uma linha de consumo por chamada ao modelo**, com custo,
provedor e `pela_reserva`. A reserva é um segundo adaptador, com `ResilientAdapter`, `SoberaniaNaSubida` própria e a
lista das tarefas aprovadas para ela (`IA_RESERVA_TAREFAS`). O orçamento são duas colunas na escola e duas na rede. A
mesma função pura e a mesma soma do mês servem a quatro leitores: o teto do lote, a medida dos alertas, o painel da
Operação e a Governança.

A avaliação é ferramenta de `tools/ia/`, rodada à mão. O `pedagogia-reviewer` e o `conformidade-reviewer` julgam as
saídas, e o Joaquim confirma as reprovadas, as duvidosas e 10% das aprovadas (Joaquim, 20/11/2026).

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/ia/consumo.ts` | alterado | `PRECO_DOS_MODELOS` com `vigenteDesde` e `fonte`; `custoDaChamada`, arredondado para cima; custo na linha da interrompida |
| `packages/core/src/ia/llm-gateway.ts` | alterado | uma linha por chamada; a reserva (§5); preço exigido na subida para todo modelo com envio externo |
| `packages/core/src/config/llm-config.ts` | alterado | `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODELO[_<PERFIL>]`, `LLM_RESERVA_CHAVE_API`, `IA_RESERVA_PROVEDOR_ID`, `LLM_RESERVA_TOKENS_POR_MINUTO`, `IA_RESERVA_TAREFAS` |
| `packages/core/src/ia/soberania.ts` | alterado | conferência por chave e categorias; a da reserva **não bloqueia** as filas |
| `apps/api/src/ia/ia-do-worker.module.ts` | alterado | monta a reserva e a segunda conferência |
| `apps/api/src/ia/` (`orcamento.repository.ts`, `execucao.processor.ts`, `orcamento-do-mes.repository.ts` novo) | alterado | teto no lote; soma do mês e alunos ativos |
| `packages/shared/src/governanca/orcamento-de-ia.ts` | novo | a conta pura do orçamento |
| `apps/api/src/operacao/painel/`, `governanca/` | alterado | as rotas da §4 |
| `apps/worker/src/orcamento-gauge.ts`, `infra/grafana/alertas/`, `docs/runbook.md` | novo | a medida e os alertas (§7c) |
| `apps/web/src/operacao/`, `areas/coordenacao/painel/` e `governanca/` | alterado | §9 |
| `tools/ia/avaliar-modelos.ts`, `tools/ia/amostras/` | novo | a avaliação (§8) |
| `docs/` (avaliação, AIAs, LGPD, modelo de dados, interface, infra 5.4) | alterado | na tarefa que muda cada um |

## 3. Modelo de dados

```
configuracao_operacional_escola  + ia_valor_por_aluno_micros bigint null (> 0)
                                 + ia_teto_de_seguranca_percentual smallint null (100 a 1000)
rede                             + as mesmas duas colunas (rede não tem escola_id: já é a exceção da operação)
consumo_ia                       + pela_reserva boolean not null default false
                                 + índice consumo_ia_mes_idx (escola_id, em)
                                   include (custo_micros, tokens_de_entrada, tokens_de_saida, pela_reserva, execucao_id)
```

Vale a escola, senão a rede; teto nulo vale 200%; nulo nos dois é "sem orçamento". Migrations de expansão: as
colunas, e o índice numa própria (regra 80.9).

**Uma linha por chamada** que chegou ao adaptador, com modelo, provedor, tokens, custo e `tentativas = 1`. A saída
inválida da primeira grava `falhou` com `IA_SAIDA_INVALIDA`. `entrada` e `saida` só na última linha da execução. A
regra fixa e a interrompida não mudam. A Governança conta `count(distinct execucao_id)`.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| GET | `/v1/operacao/uso-ia` | operador | `?pagina=&ordem=nome\|custo` | por escola: `hoje` e `mes` (`execucoes`, `tokens`, `custoMicros`, `pelaReserva`), `alunosAtivos`, `valorPorAlunoMicros`, `origemDoValor`, `porcentagem`, `situacao` |
| GET | `/v1/operacao/escolas/:id/uso-ia` | operador | — | os 12 meses anteriores, com os mesmos números |
| PUT | `/v1/operacao/escolas/:id/orcamento-ia` | operador | `{ valorPorAlunoCentavos: int\|null, tetoDeSegurancaPercentual: int\|null }`, `chaveEnvio` | o orçamento vigente |
| PUT | `/v1/operacao/redes/:id/orcamento-ia` | operador | igual | igual |
| GET | `/v1/governanca/consumo` | coordenação | (inalterada) | `orcamento { situacao, porcentagem, aviso: 80\|100\|null }`, `porFuncao [{ funcao, parte, execucoes }]`, `tutor`; **sem** tokens e custo |

`situacao`: `definido`, `sem_orcamento` ou `sem_aluno_ativo`. `parte` (0 a 100) é a fatia dos tokens do mês: vale no
falso e não revela custo. "Hoje" é o dia de São Paulo até agora (a infra segue no último dia fechado, e a tela diz). O
`PUT` é idempotente pela `chaveEnvio`; id inexistente responde `NAO_ENCONTRADO`.

## 5. Fluxo

**A chamada.** A reserva é *elegível* se configurada, conferida na subida e com a tarefa em `IA_RESERVA_TAREFAS`.
(1) Sem vaga no principal depois da espera e do modelo menor, a chamada vai à reserva elegível, no balde
`provedor-da-reserva:modelo` (`LLM_RESERVA_TOKENS_POR_MINUTO`). Sem vaga ali, `IA_INDISPONIVEL` com `sem_vaga`. (2)
Queda do principal passa à reserva, uma vez, se o sinal da execução não abortou. Conta como queda: disjuntor aberto,
`IA_INDISPONIVEL` de servidor ou conexão, e `IA_TEMPO_ESGOTADO` da chamada. O 429 que sobra da repetição vale como
"sem vaga". (3) A repetição por saída inválida fica no provedor que respondeu. (4) A reserva que falha termina como
hoje: interativo indisponível, lote adiado. Cada chamada da reserva soma `ia.degradacao{degrau="reserva"}`. O Tutor
nunca vai ao modelo menor (D36).

**A subida.** O principal segue como na X6. A reserva exige as categorias das tarefas da lista. Sem conferência, ela
fica não elegível, confere de novo a cada 5 s, e `ia.reserva.conferida = 0`. Nome fora de `TAREFAS_DE_IA` na lista,
ou modelo da reserva sem preço, recusa a subida.

**O teto de segurança.** `OrcamentoQuery` ganha `fila`; só a `lote` é conferida. Com `situacao = definido` e o custo
do mês acima de orçamento × teto ÷ 100: `IA_ORCAMENTO_ESGOTADO`, com `tenteDeNovoEmSegundos` = mín(até a virada do mês,
3.600), para o teto novo valer em até uma hora. O processador adia (`JobAdiadoError`, motivo `orcamento`), sem
tentativa. Banco fora: a porta fecha e o lote adia, como hoje.

**Alunos ativos:** a contagem de hoje, pela regra da aba Escolas (pergunta 3 do PRD).

## 6. Isolamento (obrigatório)

`OrcamentoDoMesRepository` lê tudo pela escola do contexto (`requireEscolaId()`), e a rede pela escola. A Operação é
a exceção da regra 10.9, no módulo do painel, com `@Unscoped` justificado e só id, nome e número; o `PUT` da escola grava
no contexto dela. Testes: A acima do teto não adia o lote de B; a soma de A sem a cláusula de escopo conta B e o teste
fica vermelho; usuário de escola nas rotas da Operação recebe 404; a coordenação de A vê só A.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais tocados | `consumo_ia.provedor` e `aluno_id`, já existentes |
| Novos campos (atualizar `docs/lgpd.md`) | nenhum de pessoa; a linha do consumo cita a reserva; entra a do orçamento de IA |
| O que vai para log | ids, códigos e a chave do provedor (`ia.geracao.reserva_usada`, `ia.reserva.conferencia_recusada`, `ia.lote.adiado_pelo_orcamento`) |
| O que entra em auditoria | `escola.orcamento_ia_alterado` e `rede.orcamento_ia_alterado`, com `antes` e `depois` (os dois números) e o operador |
| O que é enviado a provedor externo | o de hoje; a reserva só recebe as tarefas da lista |
| Retenção e expurgo | sem mudança; o expurgo pega todas as linhas da execução |
| Arquivo do titular | sem versão nova: o compartilhamento já lê `consumo_ia.provedor` |
| Autorização por objeto | `OperadorGuard`; a coordenação pela permissão da Governança, na escola do contexto |
| DTO de saída | os da §4, estritos; a coordenação sem custo nem tokens |

## 7b. Conformidade CNE

Sem função nova nem autonomia nova (D9); muda o modelo que atende. Tarefa só entra em `IA_RESERVA_TAREFAS` com o
relatório aprovado para o modelo da reserva, com as mesmas taxas do principal (§3 da avaliação, classificação, risco à
vida). A regra fixa da D36 vem antes de qualquer provedor. As AIAs ganham principal, reserva e modelo menor. As
amostras são escritas por subagente em contexto limpo; nenhum prompt nem padrão muda com elas (itens (b) e (c) não se
aplicam).

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente? | o gateway e o lote |
| Carga na manhã de segunda | a da X6 (`docs/infra.md` 3.2); linhas de consumo × ~1,05; uma soma pelo índice cobridor por execução de lote |
| Fila, prioridade e limite por escola | sem mudança; a reserva herda a fila; o teto só no lote |
| Rate limit | o limitador do operador, que já existe; teste do 429 no `PUT` |
| Corridas de concorrência | dois `PUT` da mesma escola: `on conflict (escola_id) do update`, vale o último, mesma `chaveEnvio` sem segunda auditoria; cenário com o primeiro segurado (`WriteBlockTrigger`), e sem o `on conflict` o segundo cai com 23505 |
| Laços e ritmo | a medida: uma soma por escola a cada 5 min; nenhuma tela se relê sozinha |
| Índices novos | `consumo_ia_mes_idx`, pelo escopo |
| Migration e volta do código | de volta, a anterior conta linhas como execuções (número inflado, sem defeito de dado) e ignora `pela_reserva`; web e API sobem juntas, e a web antiga com a API nova cai no `ErrorState` da Governança (runbook) |
| Quando cada dependência cai | principal fora: reserva; as duas: como na X6; Redis: o balde seguro da X6, também na reserva; banco: o lote adia e a medida fica sem série |
| O erro que não diz se gravou | nenhum novo na tela |
| Métrica e alerta | `ia.orcamento.uso_do_mes{escola_id}` (alertas 0,8 e 1,0), `ia.orcamento.uso_do_teto{escola_id}` (1,0), `ia.reserva.conferida` (0 por 10 min); cada um com runbook |
| Cenário de carga | fase `reserva` no `carga.ts`: o principal falso cai no meio, e o p95 do Tutor fica até 1 s acima do da X6 |

## 8. Uso de IA

Nenhuma tarefa nova: na reserva, cada uma tem o mesmo perfil, schema, conferência e aprovação humana de hoje. A
avaliação (`tools/ia/avaliar-modelos.ts`) lê `tools/ia/amostras/avaliacao-1.json` (sha256 no relatório) e grava
`docs/avaliacao/<finalista>/<data>/` com `saidas.jsonl`, `julgamento.jsonl` e `relatorio.md`. A página citada, o código
BNCC (`medir-classificacao`) e o disparo da D36 (`medir-risco-a-vida`) são medidos pela máquina; o resto é julgado como
na §1.

Cada amostra roda pela tarefa de verdade (`TASK_CATALOG`), num `OpenAICompatAdapter` de `AVALIACAO_*`, chave fora do
repositório. A equidade compara pares em norma culta e informal. Custo: ~325 chamadas ×
~3.250 tokens, pior de três, ~R$ 30 por finalista no Sabiá 4 BR-SP. O custo por aluno não muda; passa a ser medido.

## 9. Frontend

**Operação, Uso:** o grupo "IA" (execuções e reais de hoje e do mês, reais por aluno contra o valor, porcentagem,
"pela reserva"), a ordem por custo e "Ver meses" (`GET …/:id/uso-ia`); no celular, cartão. **Operação, Escolas:**
"Orçamento de IA" em rede e escola abre o diálogo com valor por aluno (R$) e teto (%), "Usar o da rede" (nulo) e a
origem do valor vigente. **Coordenação:** o Painel diz "IA do mês: N% do previsto" e a Governança troca os tokens pela
`parte`, sem custo; os textos do aviso e dos dois estados entram em `docs/interface.md` 5, com a D40. Tudo sai da §4;
nenhuma tela calcula porcentagem.

## 10. Testes

Por camada e por RF, com o isolamento, a corrida, as mutações e os textos: `cenarios.md`. E2E: a Operação define o
orçamento e vê o uso; a coordenação vê a porcentagem e o aviso (`computador` e `celular`).

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 10, 20, 70, 80 | §6, §7, §7b, §7c | — | — |
| 30 | perfil herdado, preço versionado, custo por chamada, nenhum teste com provedor pago | 30.8 pede "corte suave": a F5 avisa e só segura o lote acima do teto, pela D40 | PRD §3 e esta linha |

## 12. Premissas não verificadas

⚠️ NÃO VERIFICADO: a Maritaca BR-SP no padrão OpenAI-compatível (`sabiazinho-4-br-sp`, `sabia-4-br-sp`) e o limite por
minuto dos modelos 4; a inferência em região da AWS Bedrock `sa-east-1`; a Magalu Cloud; a seção 20(d) do Google, lida em
parte. Até a conferência, valem o `OpenAICompatAdapter` e o falso.

## 13. Riscos técnicos

- Sem reserva no Brasil, a reserva é outro modelo da Maritaca, com outro balde (PRD §10)
- Até o disjuntor abrir, os primeiros alunos esperam os 20 s do `rapido` antes da reserva; a fase `reserva` mede
- A soma do mês sob demanda cabe nas dez escolas da D25; acima disso, consolidar por dia (`TODO.md`)
