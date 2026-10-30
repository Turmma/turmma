# Tarefa 9.0 — Onda do kit visual, símbolos (linha web)

**Funcionalidade:** nomes-de-mercado · **Depende de:** 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os componentes do kit (`apps/web/src/components/ui/`, menos a onça) passam ao nome do shadcn, do Radix e do AI
Elements: `Button`, `Card`, `Dialog`, `Sheet`, `AIMessage`, `AgentAvatar`, `PromptInput`. Nenhuma tela muda. A trava
de que o avatar só entra pelas duas peças assinadas continua recusando.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda" (o mapa leva `"linha": true`)
- `techspec.md` §5, §9 e §10
- `prd.md` RF5 e RF7
- `inventario-web-e2e.md` §1 a §5, mais "Não muda, mas parece". As linhas de `inventario-adenda-2.md` com caminho no
  kit
- `inventario.md` §1, a linha "kit visual"
- `travas.md`, as linhas com 9.0 na coluna "Onda"
- `.claude/rules/50-frontend.md` e `.claude/rules/70-conformidade-cne.md`, item 4a (D58)

## Subtarefas

- [ ] 9.1 — O mapa `tools/renomear/mapas/9.json`, com `"linha": true`
- [ ] 9.2 — O `aplicar` e a classificação. `Tela` e `Tabela` em prosa, as classes CSS e os `data-testid` ficam
- [ ] 9.3 — As travas: a regex `/from '\.\/AvatarAgente'/` de `Mensagem.test.tsx` passa a `AgentAvatar`, e
  `MensagemIA` passa a `AIMessage` em `avatar-so-nas-duas-pecas.test.ts`
- [ ] 9.4 — O `conferir` e o `restos`. O diff da onça vazio. A busca dos nomes antigos em `apps/web/src` e `e2e/`
- [ ] 9.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/` | alterado |
| `tools/renomear/mapas/9.json`, `tools/renomear/mapas/9.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos (RF7); nenhum `JsxText` muda | |
| `restos` | ferramenta | nada sobra em código | |
| esteira | esteira | verde na esteira da spec, depois do encontro | |
| teste de fidelidade da onça | diff | verde, sem diff (RF5) | |
| `Tela` e `Tabela` em prosa, classe CSS e `data-testid` | `conferir` | intactos | |
| `Mensagem.test.tsx`, B | mutação | a mensagem que importa `AgentAvatar` sem a assinatura: vermelho (D58) | |
| `avatar-so-nas-duas-pecas`, A | mutação | vermelho com `MensagemIA` | |
| `avatar-so-nas-duas-pecas`, B | mutação | vermelho com o nome novo proibido | |

## Como testar

- O teste de componente leva `// @vitest-environment jsdom` na primeira linha:
  `npx vitest run --project unidade apps/web/src/components/ui/ai/`.
- A onça: `npx vitest run --project unidade apps/web/src/components/ui/onca/`, e
  `git diff --stat -- apps/web/src/components/ui/onca/` vazio.
- A galeria (`apps/web/src/gallery/`) usa o kit: o `aplicar` a alcança pelo `tsconfig` da web.
- Telas: nenhuma muda. O `frontend-reviewer` confere pelo `conferir`, porque não há foto nova.
- Ao fechar, a linha não espera a esteira (Tech Spec §7c).

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: nenhum texto de tela entra nem sai. Se o `conferir` acusar um `JsxText`,
pare.

## Fora do escopo desta tarefa

A web fora do kit (10.0), a onça e os documentos (13.0, com o `README` do kit).

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`.

## Recomendações sem aplicar
