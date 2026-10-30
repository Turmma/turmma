# Tarefa 4.0 — Onda do core, símbolos

**Funcionalidade:** nomes-de-mercado · **Depende de:** 3.0, e a correção `2026-10-29-links-do-runbook` trazida da `develop`
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

As classes, interfaces, tipos, constantes, funções e decorators do `packages/nucleo` passam ao nome de mercado:
`Unscoped`, `requireEscolaId`, `Database`, `FakeAdapter`, `InvariantException` e o resto do anexo. Arquivos, pastas e
pacote ficam para a 5.0. As travas de isolamento, de log, de auditoria e da camada de IA continuam recusando o que
recusavam.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda"
- `techspec.md` §5, §6, §7, §7b, §7c (o `db:gerar`) e §10
- `prd.md` RF3, RF7 e RF11
- `inventario-core-shared.md`, as linhas com "Onde" em `nucleo/` dos §2 a §15. As 26 linhas `packages/nucleo` de
  `inventario-adenda-2.md`
- `inventario.md` §1 e as adendas 1 e 3
- `travas.md`, as linhas com 4.0 na coluna "Onda"
- `.claude/rules/10-multitenancy.md` (itens 3 e 9) e `.claude/rules/30-camada-ia.md`

## Subtarefas

- [ ] 4.1 — O mapa `tools/renomear/mapas/4.json`. As adendas valem: o `this.name` acompanha a classe, e o leitor de
  configuração é `load<X>Config`
- [ ] 4.2 — O `aplicar` e a classificação. A regex de `CHAVES_DOS_MARCADORES` parte o nome e o passo 6 não a acha:
  troque à mão
- [ ] 4.3 — As travas:
  - `TIPOS_DO_BANCO`, `PROVAS_DE_ESCOPO` e o export `SemEscopo`;
  - `inserirAuditoria` em `REPOSITORIES_SEM_ESCOPO`;
  - `'@SemEscopo('`;
  - `CHAVES_DOS_MARCADORES` e as fixtures 653, 654 e 660;
  - `resumirErro` e `LoggerDoNest`;
  - `porta-unica`, a linha 74, o `toEqual` da 83 e a regex da 49.

  As fixtures do escopo continuam importando `@educa/nucleo` até a 5.0
- [ ] 4.4 — O `conferir`, o `restos` e o `db:gerar` sem migration. A busca dos nomes antigos em `apps/web/src`, `e2e/` e
  `docs/`
- [ ] 4.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/` | alterado |
| `apps/` | alterado |
| `e2e/` | alterado |
| `infra/` | alterado |
| `tools/guardas/` | alterado |
| `tools/processo/guardioes-por-caminho.ts` | alterado |
| `tools/ia/` | alterado |
| `tools/testes/` | alterado |
| `tools/renomear/mapas/` | novo |
| `CLAUDE.md` | alterado |
| `.claude/` | alterado |
| `docs/` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos, e nenhum teste de isolamento sai (RF7) | |
| `restos` | ferramenta | nenhum `de` sobra (RF3) | |
| `db:gerar` | comando | sem migration, e o `_journal` sem diff | |
| esteira | esteira | tudo verde | |
| `TIPOS_DO_BANCO` e `PROVAS_DE_ESCOPO`, forma A | mutação | `sem-prova`, `banco-por-parametro`, `funcao-exportada` e `executor-de-auditoria` ficam vermelhos (`repositories-com-escopo.test.ts`, 155 a 176) | |
| `inserirAuditoria`, forma C | mutação | `lista-metodo-inexistente`: vermelho | |
| `'@SemEscopo('`, forma A | mutação | `@Unscoped(` chama o `tenancy-guardian` | |
| `CHAVES_DOS_MARCADORES`, forma A | mutação | os casos 653, 654 e 660: vermelhos | |
| `summarizeError` e `NestLogger`, forma A | mutação | `{ erro: e.message }` continua vermelho | |
| `porta-unica`, forma B | mutação | a linha 74: vermelha | |
| `porta-unica`, forma A | mutação | a linha 83 e a regex da 49: vermelhas | |

## Como testar

- O escopo: `npx vitest run --project unidade tools/guardas/repositories-com-escopo.test.ts`. O caso `reprovaOndeDiz`
  lê a fixture por nome.
- Os guardiões: `tools/processo/harness/guardioes.test.ts`, que escreve os literais por extenso.
- O log: `tools/guardas/guardas.test.ts › guarda de log com dado pessoal`.
- A porta única: `npx vitest run --project unidade packages/nucleo/src/auditoria/porta-unica.test.ts`.
- Os marcadores: `apps/api/test/arquitetura.test.ts`, de 640 a 665.
- A correção `links-do-runbook` tem de estar na spec antes do mapa: `git log --oneline -- infra/grafana/alertas/`.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6: depois do rename, a guarda de escopo continua reprovando o repository sem
prova? Rode as fixtures, não só a árvore.

## Fora do escopo desta tarefa

Arquivo, pasta e pacote do core (5.0). Os símbolos dos apps (7.0 a 11.0).

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`.

## Recomendações sem aplicar
