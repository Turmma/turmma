# Correção — a base fixa de contexto passou de 40.000 B (40.006 B) e `base-fixa.test.ts` ficou vermelho

**Origem:** esteira/portão local, `tools/processo/harness/base-fixa.test.ts` › "o repositório de hoje passa…", vermelho desde o `8d624453` (D87).
**Subagentes obrigatórios:** `test-engineer`
<!-- Os guardiões vieram no PEDIDO do Orquestrador: nenhum além dos de sempre. A correção leva 1 arquivo fora de tasks/ e não toca
     `.github/`, `tools/ci/` nem `tools/processo/`, então o `revisor-geral` não é obrigatório pelo limite do passo 5. -->

## Sintoma

`avaliar(RAIZ, antes)` devolve `base fixa de 40006 B, acima de 40000 B`. O `CLAUDE.md` (13.502 B) mais as regras 10, 20 e 70 somam 40.006 B.

## Fora desta correção

Os arquivos da tarefa 1.0 em curso (lista em `.processo/ordens/arquivos-da-1.0-em-curso.txt`: `apps/`, `packages/`, `docs/`, `tools/guardas/tabelas-do-nucleo.mjs`, `tasks/prd-semana-do-professor/`, a migration 0041). Ficam na árvore; não entram na revisão nem no commit.

## Causa

A D87 acrescentou uma linha ao índice de decisões do `CLAUDE.md` (cerca de 80 B) e levou a soma de 39.9xx para 40.006 B. O índice cresce uma linha por decisão; a prosa em volta não foi revista desde a D54.

## Teste que reproduz

`tools/processo/harness/base-fixa.test.ts` › "o repositório de hoje passa, com a medida de antes gravada e as contagens mínimas": vermelho no HEAD (40.006 B), verde depois. O limite (`LIMITE_DA_BASE_FIXA`) não muda, e nenhum item numerado das regras 10, 20 e 70 sai.

## Correção

Enxugada a prosa do `CLAUDE.md`, sem mexer na tabela de decisões, nas seis regras nem nas regras 10, 20 e 70: o cabeçalho (nome do produto e repositório), a lista de "conflitos já resolvidos" (que `docs/decisoes.md` repete), o fecho da seção Stack e duas entradas do mapa dos documentos (mockup e negócio). O arquivo perdeu cerca de 360 B, e a base fixa ficou em 39.642 B, com 358 B de folga.

**Sem mutação:** a correção só altera `CLAUDE.md` (documentação), e nenhum arquivo de `apps/*/src` nem de `packages/*/src`.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 14:44:51 | 2026-11-06 14:45:24 | `test-engineer` | 1 | APROVADO | aa1924f8e37e0a0c0 |
