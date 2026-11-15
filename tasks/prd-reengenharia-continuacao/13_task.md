# Tarefa 13.0 — Uma tela que quebra fora de uma área mostra a falha com o caminho de volta (56.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Um componente que lança numa rota sem área (entrada, sala pública, troca de senha, sistema) mostra a `Falha` de página
inteira, com texto próprio, em vez da página branca. A `Falha` ganha "Voltar ao início", que leva a `/` (na operação, a
`/operacao`) e limpa a fronteira, ao lado do "Tentar de novo" de hoje.

## Contexto necessário

- `techspec.md` §5 "A web (52.0, 56.0)" (a parte da fronteira), §9
- `prd.md` RF12
- `docs/interface.md`: a tela de falha; `.claude/rules/` 40, 50
- Código: `apps/web/src/components/AreaErrorBoundary.tsx` (`Falha`, l.30; o `Button` que recarrega, l.47; `paginaInteira`,
  l.52; a classe, l.63); `apps/web/src/routes.tsx` (`AppRoutes`, l.190, e o `<Switch>` dele); `apps/web/src/components/drawer-context.ts`;
  `apps/web/src/components/ui/` (o botão secundário)

## Subtarefas

- [ ] 13.1 — `AreaErrorBoundary paginaInteira`, com título e texto próprios, em volta do `<Switch>` de `AppRoutes`, sem casca
  e com o `DrawerContext` padrão
- [ ] 13.2 — "Voltar ao início" na `Falha`: `<a href="/">` (recarrega a página e limpa a fronteira), secundário, 44 px; na
  operação, `/operacao`. Os dois botões quebram em linha sem cortar texto a 360 px
- [ ] 13.3 — `docs/interface.md`: a Parte A da tela de falha
- [ ] 13.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/components/AreaErrorBoundary.test.tsx`, `e2e/tela-de-falha.spec.ts` | novo |
| `apps/web/src/components/AreaErrorBoundary.tsx`, `apps/web/src/routes.tsx`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| fora de área | U | componente que lança na raiz, um caso por rota sem área (entrada, sala pública, troca de senha, sistema): a `Falha` aparece, sem casca. Mutação: tirar a fronteira do `<Switch>` | |
| volta | U | o clique em "Voltar ao início" leva a `/`, e a tela sai da `Falha` | |
| operação | U | na `/operacao`, o destino é `/operacao`. Mutação: o destino fixo `/` | |
| dentro de área | U | a fronteira da área continua a que pega primeiro: a casca fica | |
| a prova não perde resposta | U | a `Falha` no meio da atividade: a fila de respostas guardada no espelho continua lá depois do "Voltar ao início" | |
| texto | U | sem termo técnico; `VOCABULARIO_DE_NOTA` não casa | |
| 1366 × 768 | E | `paginaNaoRola`, os dois botões visíveis | |
| 360 px | E | os dois botões quebram sem cortar texto, alvos de 44 px, sem rolagem horizontal, axe. A falha vem de `page.route` (resposta que quebra o componente), sem gancho no build de produção | |
| foco | E | a `Falha` recebe o foco no título | |

## Como testar

- Fronteira: não há teste de `AreaErrorBoundary`; o mais próximo é `apps/web/src/components/CascaDaEscola.test.tsx` (montagem
  com rotas e `wouter`); lance de dentro de um componente de teste
- Fila de respostas: `apps/web/src/areas/aluno/espelho-da-fila.test.ts` (o espelho que guarda a fila)
- e2e: `e2e/casca-no-celular.spec.ts` como forma do 360 px; `e2e/support/coordenacao.ts` (`paginaNaoRola`)
- Comandos: `npx vitest run --project unidade apps/web/src/components/AreaErrorBoundary.test.tsx`;
  `node tools/ci/e2e.ts --manter-ambiente e2e/tela-de-falha.spec.ts`
- **Telas:** sem papel, `/entrar` com um componente que lança (via `page.route`); `operacao`, `/operacao` idem

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: `grep -rln 'Voltar ao início' e2e/`. Na 5: a ausência da casca depois de a
`Falha` aparecer.

## Fora do escopo desta tarefa

O prazo das chamadas (12.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
