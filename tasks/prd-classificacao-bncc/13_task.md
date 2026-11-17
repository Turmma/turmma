# Tarefa 13.0 — A coordenação vê, por série, as habilidades sem material

**Funcionalidade:** classificacao-bncc · **Depende de:** 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Na aba Cobertura de Material, a coordenação escolhe a série e vê, por componente (área, no EM), as habilidades da BNCC
que nenhum material em uso cobre, e quantas seções ainda estão sem classificação.

## Contexto necessário

- `techspec.md` §4 (`GET /v1/materiais/cobertura`, antes de `:id`), §5 "Cobertura" e "Suspensão", §7c (`EXPLAIN`), §9
- `prd.md` RF19, RF20
- `cenarios.md` "Cobertura (RF19)", as linhas de cobertura em "Permissão e isolamento" e em "Seções e agendamento"
  (componente apagado), "Telas" (o [U] da cobertura)
- `docs/interface.md` §3, Material (as abas)
- `.claude/rules/`: 10, 50, 80 (itens 3 e 8)
- Código: `apps/api/src/material/material.controller.ts` (`GET /resumo` e `GET /busca` antes de `GET /:id`),
  `material.repository.ts` (o filtro `declaradoParaASerie`, `proprioOuComLicencaVigente`), `COMPONENTES_BNCC` (1.0);
  `apps/web/src/areas/coordenacao/material/Material.tsx` (`abaDoEndereco`), `ResumoDoMaterial.tsx`

## Subtarefas

- [ ] 13.1 — `GET /v1/materiais/cobertura?serieId=`: candidatas da série menos as habilidades das seções de material no filtro da F4; com a função suspensa, só as corrigidas; `secoesSemClassificacao`
- [ ] 13.2 — A aba Cobertura (`?aba=cobertura`), com a escolha da série e os quatro estados; a Parte A no `docs/interface.md`
- [ ] 13.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/material/cobertura.ts`, `packages/shared/src/index.ts` | novo e alterado |
| `apps/api/src/material/material.controller.ts`, `apps/api/src/material/cobertura.repository.ts`, `apps/api/src/material/material.service.ts` | novo e alterado |
| `apps/api/test/cobertura.int.test.ts` | novo |
| `apps/web/src/areas/coordenacao/material/Material.tsx`, `apps/web/src/areas/coordenacao/material/Cobertura.tsx`, `apps/web/src/areas/coordenacao/material/Cobertura.test.tsx`, `apps/web/src/areas/coordenacao/material/api/cobertura.ts`, `apps/web/src/paths.ts` | novo e alterado |
| `e2e/material-cobertura.spec.ts`, `docs/interface.md` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| excluído o único material de uma habilidade | I | ela aparece | |
| licença vencida; `processando`; `falhou`; substituído; seção `aguardando` | I | não cobrem, um caso cada | |
| não classificada | I | conta em `secoesSemClassificacao` | |
| `EF69LP01` num material só do 6º | I | não cobre o 7º | |
| EM | I | por área | |
| material de duas séries | I | cobre nas duas | |
| componente apagado | I | deixa de contar o código | |
| suspensa | I | só as corrigidas contam | |
| suspensa e retomada, no componente apagado | I | não conta o código antigo | |
| professor; rede | I | recusados | |
| `serieId` da B | I | `NAO_ENCONTRADO` igual ao inexistente. Mutação: tirar `escola_id` da série | |
| material da B que cobriria a habilidade da A | I | não cobre. Mutação: tirar `escola_id` | |
| `/cobertura` | I | não é capturada por `:id` | |
| `EXPLAIN` | I | usa os índices da §7c no cenário da carga | |
| série | U | a escolha | |
| carregando; erro; vazio da escola sem material; com dado | U | um caso cada; `secoesSemClassificacao` ao lado | |
| 1366 × 768; uma ação cheia; vocabulário | E | `paginaNaoRola`; `VOCABULARIO_DE_NOTA` | |
| 360 px | E | 44 px no `celular`, axe | |
| recomeço: segunda pessoa; mesma série; 6º segurado e troca para o 7º; falha e "Tentar de novo" | E | um caso cada | |

## Como testar

- Filtro da F4: `apps/api/test/material-resumo.int.test.ts` (o resumo por série já usa o mesmo filtro)
- Rota antes de `:id`: como `GET /resumo` em `material.controller.ts`
- Isolamento: `material-isolamento.int.test.ts` › "ler material de B responde o mesmo 404 do inexistente…"
- Tela: `Material.test.tsx` › "vazio: \"Nenhum material ainda\"…" e o `describe` "os quatro estados da tela"
- e2e: `e2e/material.spec.ts` › "os estados sem dado: carregando, erro com \"Tentar de novo\", e o vazio que convida a enviar"; `paginaNaoRola`
- Comandos: `npx vitest run --project integracao apps/api/test/cobertura.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/material-cobertura.spec.ts`
- Telas: `coordenacao`, `/coordenacao/material?aba=cobertura`, com a série escolhida

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: uma habilidade coberta e uma não, na mesma série.

## Fora do escopo desta tarefa

Paginar a cobertura além da escolha da série (a lista de uma série cabe em ~200).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

