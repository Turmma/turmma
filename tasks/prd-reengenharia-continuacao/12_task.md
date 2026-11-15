# Tarefa 12.0 — Toda chamada da web à API tem prazo, e a resposta de prova pendurada não trava as outras (52.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `infra-guardian`, `frontend-reviewer`
**Porte:** pequeno

## Objetivo

O `apiRequest` liga um `AbortController` próprio ao sinal de quem chamou, com prazo por tipo (leitura 20 s, PDF 30 s,
envio de arquivo 180 s, resposta de prova 10 s): estourado, vira `ApiError(TEMPO_ESGOTADO)` e a tela mostra "Tentar de
novo"; cancelado por quem chamou, relança o `AbortError` e não aparece erro. Os dois `fetch` de fora do cliente passam pelo
mesmo prazo, e o lint barra `fetch` novo fora dele. O `PUT` de resposta estourado vai para o fim da fila de respostas.

## Contexto necessário

- `techspec.md` §5 "A web (52.0, 56.0)" (a parte do prazo)
- `prd.md` RF11; §7 ("A rede da escola trava no meio da prova")
- `tasks/prd-reengenharia/onda-3c.md` "T13 — a prova (51.0 e 53.0) e o prazo do cliente (52.0)"
- `.claude/rules/` 40, 50, 80 (item 6)
- Código: `apps/web/src/api/client.ts` (`apiRequest` l.81, o `signal` l.94); `apps/web/src/areas/coordenacao/material/api/material.ts:115`;
  `apps/web/src/areas/professor/artefatos/api/artefatos.ts:115`; `apps/web/src/areas/aluno/fila-de-respostas.ts`
  (`criarFilaDeRespostas`, l.55); `eslint.config.mjs`; `tools/guardas/index.mjs`

## Subtarefas

- [ ] 12.1 — `comPrazo` em `client.ts`; o tipo de chamada escolhe o prazo; `TEMPO_ESGOTADO` no catálogo de erros da web
  (se faltar em `shared`, a tarefa diz por que não toca o tronco)
- [ ] 12.2 — `material.ts` e `artefatos.ts` com `comPrazo`
- [ ] 12.3 — `no-restricted-globals` (e o seletor para `globalThis.fetch`, `window.fetch`, `self.fetch`) em `apps/web/src`, com
  exceção só para `api/client.ts`; registrada em `tools/guardas/index.mjs`
- [ ] 12.4 — O `PUT` estourado volta ao fim da fila, com a mesma sequência; a questão seguinte sai
- [ ] 12.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/guardas/__fixtures__/fetch-fora-do-cliente/` | novo |
| `apps/web/src/api/client.ts`, `apps/web/src/api/client.test.ts`, `apps/web/src/areas/coordenacao/material/api/material.ts`, `apps/web/src/areas/professor/artefatos/api/artefatos.ts`, `apps/web/src/areas/aluno/fila-de-respostas.ts`, `apps/web/src/areas/aluno/respostas.test.ts`, `eslint.config.mjs`, `tools/guardas/index.mjs`, `tools/guardas/guardas.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| leitura estoura | U | relógio falso: aos 20 s, `TEMPO_ESGOTADO`; aos 19,9 s, não | |
| PDF, envio, prova | U | 30 s, 180 s, 10 s: um caso cada | |
| cancelamento | U | quem chamou cancela: `AbortError` relançado, nenhum `ErrorState` | |
| o prazo libera | U | resposta antes do prazo: o temporizador sai, nenhum abort depois | |
| a tela | U | `TEMPO_ESGOTADO` mostra "Tentar de novo", e a nova tentativa chega | |
| fora do cliente | U | `material.ts` e `artefatos.ts` estouram no prazo deles | |
| guarda, quem contorna | U | uma fixture por forma: `fetch`, `globalThis.fetch`, `window.fetch`, `self.fetch`, desestruturação (`const { fetch } = window`), reexportação e `import()` de um módulo que chama `fetch` | |
| guarda, alvo some | U | `api/client.ts` renomeado: a exceção não acoberta o arquivo novo, e a guarda acusa | |
| guarda, o real | U | o repositório passa sem nenhuma ocorrência fora de `client.ts` | |
| prova pendurada | U | o `PUT` estoura, vai para o fim, a questão seguinte sai. Mutação: devolver ao início | |
| prova, resposta velha | U | o `PUT` estourado chega atrasado depois de o aluno mudar a mesma questão: a nova vale | |
| prova, recomeço | U | depois do estouro, a mesma questão sai de novo com a mesma sequência | |

## Como testar

- Cliente: `apps/web/src/api/client.test.ts` › "busca cancelada pelo TanStack Query sai como cancelamento, e não vira erro de
  indisponível na tela" e "sem rede, é indisponível…"; relógio com `vi.useFakeTimers`
- Fila: `apps/web/src/areas/aluno/respostas.test.ts` › "a gravação que falha NÃO tira a escolha da fila, e a escolha que sai
  de novo leva a mesma sequência" e "quem troca de alternativa enquanto a anterior é salva continua com a nova na fila"
- Guarda: `tools/guardas/guardas.test.ts`, com as fixtures das outras regras de `tools/guardas/__fixtures__/`
- Comando: `npx vitest run --project unidade apps/web/src/api/client.test.ts apps/web/src/areas/aluno/respostas.test.ts`
- Armadilha: "nenhum `ErrorState`" só vale depois de a promessa terminar (autoconferência 5)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6: uma fixture e um vermelho por forma de chamar `fetch`. Na 10: a resposta
velha com a ordem forçada.

## Fora do escopo desta tarefa

A tela de falha (13.0); o 503 com `Retry-After` (14.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
