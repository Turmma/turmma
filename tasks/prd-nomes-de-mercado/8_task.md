# Tarefa 8.0 — Onda do worker, do despachante, do realtime e do apoio de teste do back (linha back)

**Funcionalidade:** nomes-de-mercado · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os símbolos técnicos do worker (`JobProcessor`, `JobSchedule`, `JobExecutor`), do despachante, do realtime e do apoio de
teste de `apps/api/test/` (`SessaoFixtures` e os outros `Bancada…`) passam ao nome de mercado. O nome de fila, de
métrica e de evento de log, e o texto dos casos, ficam como estão.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda" (o mapa leva `"linha": true`)
- `techspec.md` §5, §7c (a linha) e §10
- `prd.md` RF3, RF6 e RF7
- `inventario-back.md`: as linhas com caminho em `apps/worker/`, `apps/despachante/`, `apps/realtime/` e
  `apps/api/test/`, mais "Não muda, mas parece". As linhas desses caminhos em `inventario-adenda-2.md`
- `inventario.md` §1 (`Bancada<X>` vira `<X>Fixtures`) e §3 (`@educa/despachante` fica)
- `.claude/rules/80-infra-e-carga.md`: fila, métrica e evento são strings que o painel lê

## Subtarefas

- [ ] 8.1 — O mapa `tools/renomear/mapas/8.json`, com `"linha": true`
- [ ] 8.2 — O `aplicar` e a classificação. A classe muda, e a string do nome da fila fica
- [ ] 8.3 — As travas: o `travas.md` não lista nenhuma desta onda. A ocorrência `trava` que o relatório achar ganha
  linha no `travas.md` e bloco de mutação aqui
- [ ] 8.4 — O `conferir` e o `restos`. A busca dos nomes antigos em `apps/` e `e2e/`
- [ ] 8.5 — A seção "Mutações"

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/worker/`, `apps/despachante/`, `apps/realtime/` | alterado |
| `apps/api/test/`, `apps/api/src/` | alterado |
| `infra/test/`, `infra/scripts/` | alterado |
| `tools/renomear/mapas/8.json`, `tools/renomear/mapas/8.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos (RF7) | |
| `restos` | ferramenta | nada sobra em código | |
| esteira | esteira | verde na esteira da spec, depois do encontro | |
| fila, métrica e evento de log | `conferir` | as strings são as mesmas | |
| `@educa/despachante` e `apps/despachante` | diff | intactos | |
| `Bancada…` e `…-de-teste` | `restos` | zero | |
| texto de `describe`, `it` e `test` | `conferir` | igual (RF6) | |

## Como testar

- O worker: `npx vitest run --project integracao apps/worker/test/`. O sandbox:
  `npx vitest run --project infra infra/test/jobs.int.test.ts`.
- O apoio de teste é importado por `apps/worker/test/`, `apps/realtime/test/` e `infra/test/`: o `aplicar` os alcança
  pelo `tsconfig` de cada um, e eles estão nos previstos.
- O nome da fila é string (`interativa`, `normal`, `lote`). Se a classe e a fila tiverem o mesmo texto, a fila é `fica`.
- Ao fechar, a linha não espera a esteira (Tech Spec §7c).

## Autoconferência

As 12 perguntas do modelo, no plano. Na 1: sem trava, não há cláusula. Se o relatório achar uma, ela ganha bloco.

## Fora do escopo desta tarefa

A api fora de `apps/api/test/` (7.0, salvo o uso que o rename arrasta), e os documentos (13.0).

## Divergências resolvidas nesta tarefa

## Mutações

**Sem mutação:** rename, sem condição nova. Vale enquanto o relatório não achar trava nova.

## Recomendações sem aplicar
