# Tarefa 8.0 — O painel do material mostra a classificação por capítulo, corrige com o seletor e pede a reclassificação

**Funcionalidade:** classificacao-bncc · **Depende de:** 7.0
**Subagentes obrigatórios:** `frontend-reviewer`, `conformidade-reviewer`
**Porte:** grande

## Objetivo

No painel do material, a coordenação vê cada capítulo (ou "Páginas X a Y") com a situação em texto e as habilidades com a
descrição e a origem; corrige escolhendo de 0 a 5 num seletor com filtro; e pede a reclassificação, com a confirmação do
que é refeito. A 11.0 reaproveita o seletor.

## Contexto necessário

- `techspec.md` §4, §9 (painel do material)
- `prd.md` RF6, RF12
- `cenarios.md` "Telas" (painel, seletor, "sem componente")
- `docs/interface.md` §3, "O painel do material"; §6 (em toda tela); §10 (peças)
- `.claude/rules/`: 50, 70
- Código: `apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx` (`Capitulos`, `CorrecaoDoMaterial`),
  `material-painel.ts` (`textoDoLimiteDeAlteracoes`), `api/material.ts` (429 e `Retry-After`);
  `apps/web/src/components/ui/fields/SearchInput.tsx` (não há combobox com filtro: o seletor é peça nova)

## Subtarefas

- [ ] 8.1 — A seção de habilidades no painel: os cinco rótulos, a marca de corrigida, a origem, o código sempre com a descrição, "capítulo" e nunca "trecho" nem "seção"; os dois avisos
- [ ] 8.2 — O seletor de habilidades em `apps/web/src/components/habilidades/`
- [ ] 8.3 — Corrigir e reclassificar, com os textos do `cenarios.md`
- [ ] 8.4 — A Parte A do painel no `docs/interface.md`
- [ ] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx`, `apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx`, `apps/web/src/areas/coordenacao/material/classificacao.ts`, `apps/web/src/areas/coordenacao/material/classificacao.test.ts`, `apps/web/src/components/habilidades/SeletorDeHabilidades.tsx`, `apps/web/src/components/habilidades/SeletorDeHabilidades.test.tsx`, `e2e/material-classificacao.spec.ts` | novo |
| `apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx`, `apps/web/src/areas/coordenacao/material/api/material.ts`, `e2e/support/material.ts`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| painel: carregando; erro com "Tentar de novo"; vazio só com a leitura terminada; com dado | U | um caso cada | |
| os cinco rótulos | U | um caso por estado; `classificada` só com as habilidades | |
| `nao_classificada` com a função suspensa | U | só o aviso, sem "Reclassificar" | |
| origem; código; nome da seção | U | "Sugerida pela IA" e "Corrigida pela coordenação"; com a descrição; "Capítulo N" ou "Páginas X a Y" | |
| seletor: de 0 a 5 | U | o sexto bloqueado | |
| seletor: filtro por código; por texto | U | um caso cada | |
| seletor: carregando; erro; sem resultado; sem componente; com dado | U | um caso cada, com os textos do `cenarios.md` | |
| reclassificar | U | desabilitado durante o pedido; confirmação com N e M | |
| avisos do componente e da suspensão | U | um caso cada; sem componente, "Corrigir" desabilitado | |
| `CONFLITO` do `PUT`; 429 | U | os textos | |
| 1366 × 768; uma ação cheia; vocabulário | E | `paginaNaoRola`; `VOCABULARIO_DE_NOTA` | |
| 360 px; alvo de 24 px no `chromebook`, 44 px no `celular` | E | sem rolagem lateral, axe; medidos | |
| teclado | E | o seletor abre, filtra e fecha; foco no botão | |
| situação | E | em texto, não só em cor | |
| recomeço: coordenação da B na mesma aba | E | não vê o painel da A | |
| recomeço: material X, Y, X | E | seletor fechado e filtro limpo | |
| recomeço: habilidades de X seguradas e Y aberto | E | as de X não aparecem | |
| recomeço: `PUT` falha e a lista recarrega | E | o erro sai e o foco volta | |

## Como testar

- Estados: `Material.test.tsx` › "erro: a mensagem curta e \"Tentar de novo\", que lê a lista de novo"; `PainelDoMaterial.test.tsx` › "a leitura dos capítulos que cai diz o que aconteceu…"
- 429: `PainelDoMaterial.test.tsx` › "o 429 do `PATCH` diz a hora em que dá para tentar de novo"
- Foco: `PainelDoMaterial.test.tsx` › "marcar outra série manda só as séries, e a mensagem de salvo recebe o foco"
- e2e: `e2e/material-painel.spec.ts` › "corrigir título e séries…"; `criarMaterialNoBanco` e `criarCapitulosNoBanco` (`e2e/support/material.ts`), e uma nova para seções e habilidades
- `npx vitest run --project unidade apps/web/src/areas/coordenacao/material/`; `node tools/ci/e2e.ts --manter-ambiente e2e/material-classificacao.spec.ts`
- Armadilha: asserção de ausência só depois da resposta que traria o que ela nega
- Telas: `coordenacao`, `/coordenacao/material?material=<id>`, a seção de habilidades e o seletor aberto (`--clicar`)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: procure os rótulos novos em `e2e/`.

## Fora do escopo desta tarefa

O artefato do professor (11.0); a aba Cobertura (13.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

