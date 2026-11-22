# Tech Spec — Provedor de reserva e avaliação dos modelos

**PRD:** `tasks/prd-reserva-e-avaliacao/prd.md`
**Status:** aprovada como parte da Tech Spec da F5 (`tasks/prd-camada-ia/techspec.md`, revisão da spec, rodada 6, em
`tasks/prd-camada-ia/revisao-spec.md`); separada dela no corte de 21/11/2026, sem mudar desenho. Os números das seções são
os da F5, para os documentos de `rascunho-das-tarefas/` continuarem certos; as seções que ficaram inteiras na F5a (§4, §6,
§9, §10) não se repetem aqui. Na abertura do andar, a revisão da spec confere este texto contra o código que a F5a deixou
(`abertura.md`).

## 1. Resumo da abordagem

A F5b estende o `LLMGateway` e o `main-worker` (X6) como a F5a deixou: preço no código (`PRECO_DOS_MODELOS`) e uma linha de
consumo **por chamada**, com custo e provedor. A aprovação de modelo também fica no código (`MODELOS_APROVADOS`; Joaquim,
20/11/2026). O **provedor de reserva** é um segundo adaptador, com resiliência e conferência próprias, e só atende tarefa e
modelo aprovados.

A avaliação roda à mão (`tools/ia/`); `pedagogia-reviewer` e `conformidade-reviewer` julgam, e o Joaquim confirma as
reprovadas, as duvidosas e 10% das aprovadas (Joaquim, 20/11/2026).

## 2. Módulos afetados

- `packages/core/src/ia/`: `modelos-aprovados.ts` (novo), `llm-gateway.ts`, `soberania.ts`, `consumo.ts` (a estimada da
  reserva); `config/llm-config.ts` com `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODELO[_<PERFIL>]`, `LLM_RESERVA_CHAVE_API` (na
  guarda de segredo), `IA_RESERVA_PROVEDOR_ID`, `LLM_RESERVA_TOKENS_POR_MINUTO`
- `apps/api/src/ia/`: `ia-do-worker.module.ts`, `consumo.repository.ts`
- `infra/grafana/alertas/`, `docs/runbook.md`, `infra/carga.env`, o `carga.ts` (fase `reserva`)
- `tools/ia/avaliar-modelos.ts`, `tools/ia/amostras/`
- `docs/`: glossário ("provedor de reserva"), avaliação, AIAs, LGPD (linha 99), infra 5.4

## 3. Modelo de dados

Nenhuma migration: a coluna `consumo_ia.pelo_provedor_de_reserva boolean not null default false` e o índice
`consumo_ia_mes_idx`, que já a inclui, entraram na F5a (2.0). A F5b é quem a grava como verdadeira.

**A estimativa** (D14: superestima custo e destino). A chamada que saiu sem voltar com uso (prazo, conexão, servidor)
grava a entrada contada e a saída no teto (F5a). A interrompida grava os dois tetos da tarefa, uma linha por destino, ao
preço de cada modelo: se a tarefa tem aprovação para o provedor de reserva configurado (só tarefa e provedor), o
`registrarEstimada` grava também a dele, na varredura e na reentrega.

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

**A subida.** O principal segue como na X6 e na F5a. A reserva passa na mesma conferência (Brasil sempre, treinamento vedado), com as
categorias das tarefas aprovadas para ela. Sem conferência, ela não é elegível, confere de novo a cada 5 s
(intervalo injetado) e `ia.provedor_de_reserva.conferido = 0`. Modelo da reserva sem preço recusa a subida, como o do
principal na F5a (`LLMConfig.exigePreco`; quem confere é o `createLLMGateway`, que cita `LLM_RESERVA_MODELO` ou
`LLM_RESERVA_MODELO_<PERFIL>`); entrada de `MODELOS_APROVADOS` com tarefa fora de `TAREFAS_DE_IA` quebra o teste da constante.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos tocados | `consumo_ia.provedor`, `consumo_ia.pelo_provedor_de_reserva` e `aluno_id`, já existentes; nenhum novo de pessoa |
| `docs/lgpd.md` | a linha 99 cita o provedor de reserva e a estimativa dele |
| Log | ids, códigos e o `provedorId` (`ia.geracao.provedor_de_reserva`, `ia.provedor_de_reserva.conferencia_recusada`); nunca a chave de API |
| Envio externo | o de hoje; a reserva só recebe as tarefas aprovadas para ela; suboperador novo só depois do aviso às escolas (runbook) |
| Retenção, titular, DTO | sem mudança; o compartilhamento lê `consumo_ia.provedor` |

## 7b. Conformidade CNE

Sem função nova nem autonomia nova (D9); muda o modelo que atende, e só por aprovação versionada (§5), com as mesmas
taxas do principal (§3 da avaliação, classificação, risco à vida). A regra fixa da D36 vem antes de qualquer provedor.
As AIAs ganham principal, reserva, modelo menor e a suspensão do agente na reserva. Amostras por subagente em contexto limpo, sem correção de
discursiva (D55, com guarda) nem trecho de material de terceiro. Nenhum prompt muda.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente e carga | o gateway: no máximo quatro chamadas por execução (§5) |
| Dependência fora | principal: reserva; as duas: como na X6, "Provedor de IA fora" para cada uma |
| Métrica e alerta | `ia.provedor_de_reserva.conferido` (0 por 10 min, só com reserva configurada), com runbook; `ia.degradacao{degrau="provedor_de_reserva"}` |
| Carga | fase `reserva` (`cenarios.md` §5); `LLM_RESERVA_TOKENS_POR_MINUTO` em `infra/carga.env`, o contratado em `docs/infra.md` 5.4 |

## 8. Uso de IA

Nenhuma tarefa nova. A avaliação (`tools/ia/avaliar-modelos.ts`) lê `tools/ia/amostras/avaliacao-1.json` (sha256 no relatório) e grava
`docs/avaliacao/<finalista>/<data>/` com `saidas.jsonl`, `julgamento.jsonl` e `relatorio.md`. Página, código BNCC (`medir-classificacao`) e disparo da D36 (`medir-risco-a-vida`) a máquina mede; o resto, como na
§1.
O relatório aprovado vira entrada em `MODELOS_APROVADOS`.

Cada amostra roda pela tarefa real, num `OpenAICompatAdapter` de `AVALIACAO_*` (chave fora do repositório): ~325
chamadas, ~R$ 30 por finalista. Nenhuma chamada nova por professor ou aluno; a
reserva custa a diferença de preço, que o relatório traz.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 10, 20, 70, 80 | §7, §7b, §7c | — | — |
| 30 | perfil herdado, aprovação versionada, nenhum teste com provedor pago | — | — |
| PRD RF2 | tarefa a tarefa | a categoria que falte tira a reserva de todas as tarefas | esta linha |

## 12. Premissas não verificadas

⚠️ NÃO VERIFICADO: a Maritaca BR-SP no padrão OpenAI-compatível e o limite por minuto; a AWS Bedrock `sa-east-1`; a
Magalu Cloud; a seção 20(d) do Google.

## 13. Riscos técnicos

- Sem segundo provedor no Brasil, a reserva é outro modelo da Maritaca (PRD §10)
- A saúde da reserva só aparece quando chamada
- Aprovação do principal: `TODO.md`
