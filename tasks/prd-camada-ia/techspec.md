# Tech Spec — Camada de IA

**PRD:** `tasks/prd-camada-ia/prd.md`
**Status:** aprovada na revisão da spec (rodada 6)

## 1. Resumo da abordagem

A F5 estende o `LLMGateway` e o `main-worker` (X6). Preço e aprovação de modelo ficam no código (`PRECO_DOS_MODELOS`,
`MODELOS_APROVADOS`; Joaquim, 20/11/2026). Uma linha de consumo **por chamada**, com custo e provedor. O **provedor de
reserva** é um segundo adaptador, com resiliência e conferência próprias, e só atende tarefa e modelo aprovados. O orçamento: duas colunas na escola, duas na rede e um retrato por mês; uma função pura faz a conta.

A avaliação roda à mão (`tools/ia/`); `pedagogia-reviewer` e `conformidade-reviewer` julgam, e o Joaquim confirma as
reprovadas, as duvidosas e 10% das aprovadas (Joaquim, 20/11/2026).

## 2. Módulos afetados

- `packages/core/src/ia/`: `consumo.ts` (`PRECO_DOS_MODELOS` por `provedor:modelo`, com `vigenteDesde` e `fonte`;
  `custoDaChamada`, para cima; a estimativa), `modelos-aprovados.ts` e `orcamento-do-mes.repository.ts` (novos; a API, o
  lote e a medida leem por ele), `llm-gateway.ts`, `soberania.ts`;
  `config/llm-config.ts` com `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODELO[_<PERFIL>]`, `LLM_RESERVA_CHAVE_API` (na guarda
  de segredo), `IA_RESERVA_PROVEDOR_ID`, `LLM_RESERVA_TOKENS_POR_MINUTO`
- `apps/api/src/ia/`: `ia-do-worker.module.ts`, `consumo.repository.ts`, `orcamento.repository.ts`,
  `execucao.processor.ts` (motivo `orcamento`)
- `packages/shared/`: `governanca/orcamento-de-ia.ts` (novo, a conta pura), `governanca/governanca.ts`, `operacao/painel.ts`
- `apps/api/src/operacao/` (painel, escola, `OrcamentoDaRedeRepository` novo), `governanca/`, `auditoria/acoes.ts`
- `apps/worker/src/orcamento-gauge.ts`, `infra/grafana/alertas/`, `docs/runbook.md`
- `apps/web/src/operacao/`, `areas/coordenacao/painel/` e `governanca/`
- `tools/ia/avaliar-modelos.ts`, `tools/ia/amostras/`
- `docs/`: glossário ("Orçamento de IA" sem corte; "provedor de reserva", "teto de segurança", "valor de IA por aluno"),
  avaliação, AIAs, LGPD (linha 99), modelo de dados, interface, infra 5.4

## 3. Modelo de dados

```
configuracao_operacional_escola  + ia_valor_por_aluno_micros bigint null (> 0)
                                 + ia_teto_de_seguranca_percentual smallint null (100 a 1000)
rede                             + as mesmas duas colunas (acima do tenant: a exceção da operação)
orcamento_ia_do_mes (novo)       escola_id, mes (date, dia 1), alunos_ativos, valor_por_aluno_micros null,
                                 teto_percentual, origem_do_valor (escola|rede|nenhuma), atualizado_em; pk (escola_id, mes)
consumo_ia                       + pelo_provedor_de_reserva boolean not null default false
                                 + índice consumo_ia_mes_idx (escola_id, em)
                                   include (custo_micros, tokens_de_entrada, tokens_de_saida, funcao,
                                            pelo_provedor_de_reserva, execucao_id)
```

Vale a escola, senão a rede, coluna a coluna; teto nulo vale 200%; valor nulo nos dois é "sem orçamento". A medida regrava o retrato do mês
corrente a cada 5 min (`on conflict do update`); o fechado guarda o último. A `auditoria` aceita
`rede.orcamento_ia_alterado` com `escola_id` nulo. O índice vai numa migration própria, sem `concurrently`, com
`lock_timeout` de 5 s, fora do horário letivo (como a 0064).

**Uma linha por chamada enviada**, com provedor, modelo, tokens, custo e `tentativas = 1`; a saída inválida grava
`falhou`/`IA_SAIDA_INVALIDA`; `entrada` e `saida` só na última (a inválida não fica para depuração, regra 20). A que
não saiu (disjuntor aberto, sem vaga) não é chamada: no lote não grava, como hoje; nas outras filas deixa a linha única da falha, como a do balde cheio na X6 (`tentativas = 0`, sem tokens, custo nem envio). O **código final da execução** não vive no consumo: a saída inválida seguida de repetição que não sai (prazo, disjuntor) deixa a linha da primeira chamada em `IA_SAIDA_INVALIDA`, e o motivo que encerrou a execução fica em `execucao_agente.erro` e no erro que sobe.

**A estimativa** (D14: superestima custo e destino). A chamada que saiu sem voltar com uso (prazo, conexão, servidor)
grava a entrada contada e a saída no teto. A interrompida grava os dois tetos da tarefa, uma linha por destino, ao
preço de cada modelo: se a tarefa tem aprovação para o provedor de reserva configurado (só tarefa e provedor), o
`registrarEstimada` grava também a dele, na varredura e na reentrega.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| GET | `/v1/operacao/uso` (estendida) | operador | `?pagina=&ordem=nome\|uso\|custo` | cada item ganha `ia`: `hoje` e `mes` (`execucoes`, `chamadas`, `tokens`, `custoMicros`, `chamadasPeloProvedorDeReserva`), `alunosAtivos`, `valorPorAlunoMicros`, `origemDoValor`, `porcentagem`, `situacao` |
| GET | `/v1/operacao/escolas/:id/uso-ia` | operador | — | os 12 meses anteriores, com os números de `ia.mes` pelo retrato |
| GET | `/v1/operacao/redes`, `/v1/operacao/escolas` (estendidas) | operador | — | o orçamento próprio e o vigente; a rede, `escolasQueUsamOValorDaRede` |
| PUT | `/v1/operacao/escolas/:id/orcamento-ia` | operador | `{ valorPorAlunoCentavos: int\|null, tetoDeSegurancaPercentual: int\|null }` | o orçamento próprio e o vigente |
| PUT | `/v1/operacao/redes/:id/orcamento-ia` | operador | igual | igual (a contagem vem do `GET …/redes`) |
| GET | `/v1/governanca/consumo` | coordenação | `?mes=` (inalterada) | `orcamento { situacao, porcentagem, aviso: 80\|100\|null }`, `porFuncao [{ funcao, parte, execucoes }]`, `tutor`; **sem** tokens e custo |

O corpo do `PUT` é um `z.strictObject` com os dois campos obrigatórios: fora da faixa, campo a mais ou campo faltando respondem **`400 ENTRADA_INVALIDA`**, o código de todo corpo recusado do painel (`VALIDACAO` não existe em `ErrorCode`). O `GET …/redes` e o `GET …/escolas` estendidos mudam o contrato de `RedeDoPainel` e `EscolaDoPainel`, e a web acompanha só no tipo e no mock (`NovaRede.tsx`, o fixture e o mock de `api/painel.test.ts`); o diálogo é da 7.0 (§9).

`situacao`: `definido`, `sem_orcamento`, `sem_aluno_ativo` ou `sem_retrato` (mês fechado antes da F5). O mês corrente
é calculado na hora; o fechado lê o retrato. `parte` (0 a 100) é a fatia dos tokens. `aviso`: o limiar já cruzado no mês corrente (`>=`); nulo no fechado. "Hoje" é o dia de São Paulo até agora. `execucoes` é `count(distinct execucao_id)` mais uma por linha sem execução; `escolasQueUsamOValorDaRede` conta valor ou teto vindo da rede. Entrada em centavos (R$ 0,01 a R$ 100,00), saída em micros. Id inexistente: `NAO_ENCONTRADO`.

## 5. Fluxo

**A aprovação.** `MODELOS_APROVADOS` lista `{ tarefa, provedorId, modelo, relatorio, sha256, aprovadoPor, aprovadoEm }`, versionada, uma por relatório aprovado
(§8); o `sha256` é do `relatorio.md`, e a guarda o recalcula. A reserva falsa leva o id de `IA_RESERVA_PROVEDOR_ID` (`falso-reserva`), com balde,
rótulo e disjuntor próprios e relatório sintético. A subida recusa reserva com o id do principal e, em produção, a falsa. O provedor de reserva é **elegível** para uma tarefa se configurado, conferido
na subida e com entrada que bate no provedor e no modelo que ele usa no perfil da tarefa. Trocar o modelo
de um perfil tira do caminho as tarefas dele até um relatório novo.

**A chamada.** (1) Sem vaga no principal depois da espera e do modelo menor, vai ao provedor de reserva elegível, no
balde `provedor:modelo` dele (`LLM_RESERVA_TOKENS_POR_MINUTO`); sem vaga ali, `IA_INDISPONIVEL`, `sem_vaga`. (2) Queda
do principal passa à reserva elegível, uma vez, se o sinal da execução não abortou. É queda: disjuntor aberto,
`IA_INDISPONIVEL` de servidor ou conexão, e `IA_TEMPO_ESGOTADO`. O 429 que sobra da repetição vale como "sem vaga". (3)
A repetição por saída inválida fica no provedor que respondeu. (4) A reserva que falha termina como hoje: interativo
indisponível, lote adiado. Uma função só confere a elegibilidade nos dois ramos. **No máximo quatro chamadas por
execução**, duas por provedor. A reserva passa pelo mesmo `chamarModelo`, com o rótulo `provedor` dela, e soma
`ia.degradacao{degrau="provedor_de_reserva"}`. O Tutor nunca vai ao menor (D36).

**A subida.** O principal segue como na X6. A reserva passa na mesma conferência (Brasil sempre, treinamento vedado), com as
categorias das tarefas aprovadas para ela. Sem conferência, ela não é elegível, confere de novo a cada 5 s
(intervalo injetado) e `ia.provedor_de_reserva.conferido = 0`. Modelo da reserva sem preço recusa a subida, e o do principal também, fora de `local` com `openai_compat` (`LLMConfig.exigePreco`; quem confere é o `createLLMGateway`, que cita `LLM_MODELO` ou `LLM_MODELO_<PERFIL>`); entrada de
`MODELOS_APROVADOS` com tarefa fora de `TAREFAS_DE_IA` quebra o teste da constante.

**O teto de segurança.** `OrcamentoQuery` ganha `fila`; só a `lote` é conferida. Com `situacao = definido` e o custo do
mês **acima** (`>`) de orçamento × teto ÷ 100: `IA_ORCAMENTO_ESGOTADO`, com `tenteDeNovoEmSegundos` = mín(até a virada,
3.600). O processador adia (`JobAdiadoError`, motivo `orcamento`), sem tentativa, e soma `ia.lote.adiado{motivo}`. Sem trava: as 2 vagas de lote podem passar do teto juntas, o que se aceita.

**Alunos ativos:** a contagem de hoje, pela regra da aba Escolas: vínculo de aluno não encerrado no ano `em_curso`,
contado uma vez. Sem ano em curso, zero.

**O `PUT`.** Uma transação: garante a linha (`insert … on conflict do nothing`), `select … for update`, lê o `antes`,
grava, e audita só quando `antes ≠ depois`. Sem `chaveEnvio` (D81); na rede, igual. **Onde moram as peças (tarefa 3.0):** o `PUT` da escola grava
pelo `OrcamentoDoMesRepository`, com dois métodos de escopo da escola (`lockConfiguracaoDaEscola`: o `insert … on conflict do nothing` e o `select … for update`; e
`saveConfiguracaoDaEscola`), porque nenhum repository do plano escreve em `configuracao_operacional_escola` e o serviço não toca tabela. A comparação do `antes` com o `depois` é
`mesmoOrcamentoDefinido`, em `packages/shared/src/governanca/orcamento-de-ia.ts` ao lado de `orcamentoVigente`; as constantes de limite, o fator de centavos para micros e os contratos
do `PUT` ficam em `packages/shared/src/operacao/painel.ts`.

## 6. Isolamento (obrigatório)

`OrcamentoDoMesRepository` lê consumo, alunos ativos, configuração e rede pela escola do contexto
(`requireEscolaId()`); a medida estende a `EscolaGauge`. Os meses e o `PUT` da escola
rodam no contexto da escola `:id` (`runInContext`, como `naEscola`). A leitura entre escolas fica nos três `@Unscoped` do I1 (`uso()`, `escolas()`, `redes()`),
só com id, nome e número; o `uso()` monta a soma e os alunos com os mesmos trechos do `OrcamentoDoMesRepository`. A
rede se grava no único `@Unscoped` do `OrcamentoDaRedeRepository` (acima do tenant). O `PUT` da escola usa os dois métodos novos do `OrcamentoDoMesRepository` (§5), sem `@Unscoped`. Rotas novas em `ROTAS_DO_PAINEL`; testes em
`cenarios.md` §2.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos tocados | `consumo_ia.provedor` e `aluno_id`, já existentes; nenhum novo de pessoa |
| `docs/lgpd.md` | a linha 99 cita o provedor de reserva e a estimativa dele; entra a do orçamento de IA |
| Log | ids, códigos e o `provedorId` (`ia.geracao.provedor_de_reserva`, `ia.provedor_de_reserva.conferencia_recusada`, `ia.lote.adiado_pelo_orcamento`); nunca a chave de API |
| Auditoria | `escola.orcamento_ia_alterado` e `rede.orcamento_ia_alterado`, com `antes`, `depois` e o operador; fora da leitura da coordenação (RF12) |
| Envio externo | o de hoje; a reserva só recebe as tarefas aprovadas para ela; suboperador novo só depois do aviso às escolas (runbook) |
| Retenção, titular, DTO | sem mudança; o compartilhamento lê `consumo_ia.provedor`; DTOs da §4 estritos, a coordenação sem custo nem tokens |

## 7b. Conformidade CNE

Sem função nova nem autonomia nova (D9); muda o modelo que atende, e só por aprovação versionada (§5), com as mesmas
taxas do principal (§3 da avaliação, classificação, risco à vida). A regra fixa da D36 vem antes de qualquer provedor.
As AIAs ganham principal, reserva, modelo menor e a suspensão do agente na reserva. Amostras por subagente em contexto limpo, sem correção de
discursiva (D55, com guarda) nem trecho de material de terceiro. Nenhum prompt muda.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente e carga | gateway e lote; consumo × ~1,05, uma soma por lote |
| Fila e rate limit | herdados; o `PUT` no limitador do operador |
| Corridas | dois `PUT` do mesmo alvo: `for update` (§5) |
| Laços e índices | medida e retrato: uma soma por escola a cada 5 min; `EXPLAIN (ANALYZE, BUFFERS)` num ano da maior escola (~1,8 milhão de linhas) para o mês, `porFuncao`, os 12 meses e o `uso()` por custo |
| Volta do código | a anterior conta linhas como execuções; web antiga: `ErrorState` |
| Dependência fora | principal: reserva; as duas: como na X6, "Provedor de IA fora" para cada uma; Redis: o balde seguro da X6; banco: o lote adia |
| Métrica e alerta | `ia.orcamento.uso_do_mes{escola_id}` (0,8 e 1,0), `ia.orcamento.uso_do_teto{escola_id}` (1,0; o runbook cita "Classificação do material atrasada"), `ia.provedor_de_reserva.conferido` (0 por 10 min, só com reserva configurada), com runbook |
| Carga | fase `reserva` (`cenarios.md` §5); `LLM_RESERVA_TOKENS_POR_MINUTO` em `infra/carga.env`, o contratado em `docs/infra.md` 5.4 |

## 8. Uso de IA

Nenhuma tarefa nova. A avaliação (`tools/ia/avaliar-modelos.ts`) lê `tools/ia/amostras/avaliacao-1.json` (sha256 no relatório) e grava
`docs/avaliacao/<finalista>/<data>/` com `saidas.jsonl`, `julgamento.jsonl` e `relatorio.md`. Página, código BNCC (`medir-classificacao`) e disparo da D36 (`medir-risco-a-vida`) a máquina mede; o resto, como na
§1.
O relatório aprovado vira entrada em `MODELOS_APROVADOS`.

Cada amostra roda pela tarefa real, num `OpenAICompatAdapter` de `AVALIACAO_*` (chave fora do repositório): ~325
chamadas, ~R$ 30 por finalista. Nenhuma chamada nova por professor ou aluno; a
reserva custa a diferença de preço, que o relatório traz.

## 9. Frontend

**Operação, Uso:** o grupo "IA" da §4, a ordem por custo, "Ver meses" e "Definir orçamento" na célula sem orçamento.
**Operação, Escolas:** o diálogo "Orçamento de IA" (rede e escola), que mostra antes e depois e, na rede, quantas
escolas mudam, antes de "Salvar orçamento" (a tarefa 3.0 não faz a tela: só ajusta o tipo e os mocks da Operação ao contrato novo, §4). **Coordenação:** "IA do mês: N% do previsto" no Painel; a Governança troca
os tokens pela `parte`. Nenhuma tela calcula porcentagem. Textos, estados, celular e acessibilidade: `cenarios.md` §4,
para `docs/interface.md` 5.

## 10. Testes

`cenarios.md`, por RF, com isolamento, corrida, mutações e textos.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 10, 20, 70, 80 | §6, §7, §7b, §7c | — | — |
| 30 | perfil herdado, preço e aprovação versionados, custo por chamada, nenhum teste com provedor pago | 30.8 pede "corte suave": a F5 avisa e só segura o lote acima do teto, pela D40 | PRD §3 e esta linha |
| PRD RF2 | tarefa a tarefa | a categoria que falte tira a reserva de todas as tarefas | esta linha |

## 12. Premissas não verificadas

⚠️ NÃO VERIFICADO: a Maritaca BR-SP no padrão OpenAI-compatível e o limite por minuto; a AWS Bedrock `sa-east-1`; a
Magalu Cloud; a seção 20(d) do Google.

## 13. Riscos técnicos

- Sem segundo provedor no Brasil, a reserva é outro modelo da Maritaca (PRD §10)
- A saúde da reserva só aparece quando chamada
- A soma do mês sob demanda cabe nas dez escolas da D25; acima disso, consolidar por dia (`TODO.md`)
- Aprovação do principal: `TODO.md`
