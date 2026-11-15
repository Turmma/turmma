# Tarefa 10.0 — Toda chamada de modelo passa pelo limite de tokens por minuto, com degradação (49.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 9.0
**Subagentes obrigatórios:** `infra-guardian`, `conformidade-reviewer`, `llm-integrator`
**Porte:** grande

## Objetivo

O `LLMGateway` reserva tokens antes de cada chamada, num limite somado entre as réplicas; sem vaga, espera até 8 s, vai ao
modelo menor (nunca no `turno_do_tutor`) e termina `IA_INDISPONIVEL`, sem troca nem erro cru, dentro do prazo único.

## Contexto necessário

- `techspec.md` §2 (linhas `packages/core/src/ia/` e `llm-config.ts`), §5 "Os tokens (49.0)", §7c, §11, §12
- `prd.md` RF7, RF8; §8b
- `onda-3c.md` "T10" (as métricas; o limitador de lá dá lugar ao `RateLimiterRedis`, D81); regras 30, 40, 70, 80
- Código: `packages/core/src/ia/llm-gateway.ts`, `resilient-adapter.ts`, `consumo.ts`; `packages/core/src/rate-limit/rate-limiter.ts`
  (`insuranceLimiter`, l.138)

## Subtarefas

- [ ] 10.1 — `TokenLimiter.reservar(modelo, estimativa, fila)` com os baldes da §5
- [ ] 10.2 — No gateway, depois da D62 e do teto: a espera (`msBeforeNext`, `pedido.sinal`), o modelo menor e o fim
- [ ] 10.3 — Configuração; métricas; alertas "Provedor de IA fora" e "Tokens acima de 80 %" com runbook; a AIA (limitação)
- [ ] 10.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/token-limiter.ts`, `packages/core/src/ia/token-limiter.test.ts`, `packages/core/src/ia/token-limiter.int.test.ts`, `apps/api/src/ia/prazo-com-tokens.int.test.ts`, `infra/grafana/alertas/ia-provedor-fora.yaml`, `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml` | novo |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/perfis.ts`, `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts`, `packages/core/src/index.ts`, `apps/api/src/main-worker.ts`, `.env.example`, `infra/test/alertas.test.ts`, `docs/runbook.md`, `docs/aia/tutor.md`, `docs/infra.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| um degrau por teste | U | com vaga roda; sem vaga espera 8 s; o menor; `IA_INDISPONIVEL`; cada um com a sua métrica | |
| Tutor pula o menor | U | `turno_do_tutor` sem vaga termina `IA_INDISPONIVEL`. Mutação: permitir o degrau no Tutor | |
| sem modelo menor | U | o degrau é pulado, e a métrica do degrau não muda | |
| menor sem preço | U | a subida falha | |
| menor e a D55 | I | `propor_ferramenta` com nota na saída do menor é recusada | |
| `consumo_ia` | I | grava o modelo que respondeu | |
| a ordem | U | a D62 e o teto recusam antes do `reservar`: nada reservado. Mutação: reservar antes | |
| prazo, espera dentro | I | vaga aos 7 s, o principal pendura: 140 s, não 147 s; Tutor aos 60 s. Mutação: espera fora do prazo | |
| prazo e o menor | I | 8 s sem vaga e o menor pendurado: aos 140 s com chamada de 600 s (mutação "espera fora": 148 s); aos 108 s com chamada de 100 s (mutação "só o que sobra": 140 s) | |
| prazo na 2.ª reserva | I | 1.ª inválida aos 135 s, sem vaga para a 2.ª: termina aos 140 s, não 143 s. Mutação: a espera ignora o `pedido.sinal` | |
| baldes | I | a `ferramenta` no teto dela não consome o geral, e o Tutor roda. Mutação: o geral antes | |
| tetos das filas | I | a `ferramenta` (15 %) e a `normal` (10 %) no teto esperam enquanto o Tutor da mesma escola roda | |
| réplicas | P | duas réplicas reservando em paralelo somam no mesmo balde | |
| Redis fora | I | cada réplica segura o teto ÷ `IA_REPLICAS` | |
| configuração | U | `LLM_TOKENS_POR_MINUTO` ausente fora do `AMBIENTE=local`: não sobe. Busca pelas variáveis que saíram | |
| métricas | U | nenhuma leva usuário nem escola | |
| alertas | U | "Tokens acima de 80 %" dispara com ≥ 0,8 do contratado, o aviso aos 70 %; "Provedor de IA fora"; `alerta-tem-runbook`. Mutação: trocar um limiar | |
| log | U | o degrau só com tarefa, modelo e código | |

## Como testar

- Prazo e espera: `packages/core/src/ia/resilient-adapter.test.ts` › "o prazo que acaba durante a espera da repetição a
  cancela: nenhum pedido sai depois dele" e "o prazo cobre a chamada e a repetição…"
- Seguro com o Redis fora: `packages/core/src/rate-limit/school-semaphore.test.ts` › "o cliente que não está pronto nem é
  consultado: quem conta é o seguro…"
- Relógio único: o prazo e o `prazoMs` no mesmo relógio falso (`cenarios.md` §4)
- Comando: `npx vitest run --project unidade packages/core/src/ia/token-limiter.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 1: o `reward`, o pulo do Tutor e cada percentual são blocos. Na 10: o caso das
réplicas com as reservas abertas juntas.

## Fora do escopo desta tarefa

O provedor de reserva (F5); o teto real e os modelos menores (D37); a carga (11.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
