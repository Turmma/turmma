# Tarefa 8.0 — A aba Uso da Operação mostra o uso de IA por escola e os 12 meses

**Funcionalidade:** camada-ia · **Depende de:** 5.0, 7.0
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Na aba Uso, cada escola ganha o grupo "IA (hoje, até agora, e mês)", com chamadas, tokens, reais, custo por aluno contra o
valor, porcentagem e o que a reserva atendeu; a ordem por custo; "Definir orçamento" na célula sem orçamento, que abre o
diálogo da 7.0; e "Ver meses", com os 12 meses anteriores.

## Contexto necessário

- `techspec.md` §4 (as duas primeiras linhas), §9 ("Operação, Uso")
- `prd.md` RF11
- `cenarios.md` §4 ("Operação, Uso", erro, celular e acessibilidade)
- `.claude/rules/50-frontend.md`, `docs/interface.md` §5a
- Código: `apps/web/src/operacao/pages/Uso.tsx`, `apps/web/src/operacao/format.ts` (R$ e números), `apps/web/src/operacao/api/painel.ts`

## Subtarefas

- [ ] 8.1 — O grupo "IA" na tabela e no cartão do celular; a infra segue "último dia fechado", e a tela diz
- [ ] 8.2 — A ordem por custo na barra; "sem orçamento definido" com "Definir orçamento"; "sem aluno ativo"
- [ ] 8.3 — "Ver meses": a lista dos 12, o vazio e "sem retrato (antes da medição)"
- [ ] 8.4 — `docs/interface.md` §5a (Uso), com os textos da `cenarios.md` §4
- [ ] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/operacao/pages/Uso.tsx`, `apps/web/src/operacao/pages/Uso.test.tsx` | alterado |
| `apps/web/src/operacao/components/MesesDeIa.tsx`, `apps/web/src/operacao/components/MesesDeIa.test.tsx` | novo |
| `apps/web/src/operacao/api/painel.ts`, `apps/web/src/operacao/api/painel.test.ts`, `apps/web/src/operacao/format.ts`, `apps/web/src/operacao/textos.ts` | alterado |
| `e2e/operacao-uso.spec.ts` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| o grupo "IA (hoje, até agora, e mês)" e a infra com "último dia fechado" | U | os dois períodos ditos | |
| chamadas, tokens, reais, custo por aluno contra o valor, porcentagem e `chamadasPeloProvedorDeReserva` na linha | U | RF11 | |
| `ordem=custo` na barra e no pedido | U | a ordem | |
| "sem orçamento definido" com "Definir orçamento", que abre o diálogo da 7.0 | U | a ação | |
| "sem aluno ativo", sem porcentagem | U | o estado | |
| "Ver meses": 12 itens com o mês em pt-BR; vazio "Ainda não há mês fechado com retrato."; "sem retrato (antes da medição)"; carregando; erro "Não foi possível carregar. Tentar de novo" | U | os meses | |
| R$ com vírgula; nenhuma tela calcula porcentagem | U | o formato; a conta é da API | |
| carregando, vazio "Nenhuma escola criada ainda.", erro, com dado; fora do contrato: "Atualize a página" | U | os estados | |
| números grandes inteiros na linha a 360 e a 1366 px; cartão e "Ver meses" sem rolagem horizontal a 360 px | E2E | celular | |
| porcentagem com texto, não só cor; alvo de 24 px em "Definir orçamento" e "Ver meses"; nada só por hover | E2E | acessibilidade | |

## Como testar

- Estados: `apps/web/src/operacao/pages/Uso.test.tsx` › "o 503 mostra a mensagem dentro da tela, que fica…" e › "sem escola
  nenhuma, o vazio convida a ir para Escolas…"
- Números grandes: `e2e/operacao-uso.spec.ts` › "14.4: as medidas de uma escola com números grandes ficam inteiras na linha…"
- Página e ordem: `e2e/operacao-uso.spec.ts` › "W6: 30 escolas, página e ordem na barra…"
- `npx vitest run --project unidade apps/web/src/operacao/pages/Uso.test.tsx` e `npx playwright test e2e/operacao-uso.spec.ts`
- **Telas:** papel operador, `/operacao/uso` (`USO_DA_OPERACAO`): ao abrir, com `?ordem=custo`, e "Ver meses" de uma escola; sem mockup

## Fora do escopo desta tarefa

O diálogo (7.0); a API (5.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

```mutacao
arquivo:
teste:
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
