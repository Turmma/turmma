# Tarefa 6.0 — A aba Licenças e o aviso `licenca-vencendo` no sino

**Funcionalidade:** ingestao-do-material · **Depende de:** 5.0
**Subagentes obrigatórios:** `privacy-guardian`, `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Na aba Licenças, dentro de Material, a coordenação vê cada licença com situação e materiais, registra uma nova e muda a
vigência sabendo quantos materiais saem ou voltam da busca; o sino avisa 30 dias antes do fim, e quando venceu com
material.

## Contexto necessário

- `techspec.md` §4 (`/v1/licencas`), §9 (linhas Licenças e Sino)
- `prd.md` RF16, RF17
- `cenarios.md` "Telas" (Licenças, Sino, textos), "Licença" (o [U] do sino)
- `docs/interface.md`: a aba Material e o sino ("cinco tipos")
- `.claude/rules/`: 20 (item 4), 40, 50 (tela)
- Código: `apps/web/src/areas/coordenacao/material/Material.tsx` (as abas); `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts`
  (`TIPOS_DA_FILA`, l.26) e `SinoDaCoordenacao.tsx`; `apps/web/src/paths.ts` (`COORDENACAO_ROUTES.material`, `MATERIAL_PARAM`)

## Subtarefas

- [ ] 6.1 — `apps/web/src/areas/coordenacao/material/api/licencas.ts` (`licencasQueryOptions`, mutações)
- [ ] 6.2 — Aba Licenças: lista com situação em texto e cor, datas dd/mm/aaaa com rótulo, contagem de materiais; as "registradas antes da F4" destacadas para revisão (R6); os quatro estados
- [ ] 6.3 — Registrar (diálogo, botão trava durante o envio, `ENTRADA_INVALIDA` no campo) e mudar a vigência (mostra quantos materiais saem ou voltam antes de confirmar)
- [ ] 6.4 — Sino: o tipo `licenca-vencendo`, de −30 a 0 dias e vencida com material; "Uma licença de material vence em dd/mm" e "Uma licença de material venceu; os materiais dela saíram da busca"; leva à aba; sem licenciante nem número por pessoa; sem reler por tempo
- [ ] 6.5 — `docs/interface.md`: a aba Licenças e os seis tipos do sino; `grep -rn 'cinco tipos' apps/web/src e2e docs`
- [ ] 6.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/material/api/licencas.ts`, `apps/web/src/areas/coordenacao/material/Licencas.tsx`, `apps/web/src/areas/coordenacao/material/Licencas.test.tsx`, `apps/web/src/areas/coordenacao/material/DialogoDeLicenca.tsx`, `apps/web/src/areas/coordenacao/material/licencas.ts`, `apps/web/src/areas/coordenacao/material/licencas.test.ts`, `e2e/material-licencas.spec.ts` | novo |
| `apps/web/src/areas/coordenacao/material/Material.tsx`, `apps/web/src/paths.ts`, `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.ts`, `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts`, `apps/web/src/areas/coordenacao/painel/SinoDaCoordenacao.tsx`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| estados: carregando, erro, vazio, com dado | U | o vazio só com a leitura terminada e sem erro | |
| situação em texto e cor, uma de cada | U | as quatro `situacao` | |
| datas | U | dd/mm/aaaa, com rótulo | |
| "registradas antes da F4" | U | destacadas (R6) | |
| `PATCH` da vigência | U | mostra quantos materiais saem ou voltam antes de confirmar | |
| clique duplo em registrar | U | um `POST` só | |
| `ENTRADA_INVALIDA` | U | o erro no campo | |
| sino: −31 dias | U | sem aviso | |
| sino: −30, 0 e +1 dias | U | avisa (um caso cada) | |
| sino: vencida sem material | U | não avisa | |
| sino: depois do `PATCH` da vigência | U | o item some | |
| textos do sino | U | sem licenciante nem número por pessoa; leva à aba | |
| isolamento | E | a coordenação da A não vê licença da B, nem no sino | |
| permissão: professor | E | não vê a aba | |
| recomeço: segunda pessoa na aba; registrar de novo; resposta atrasada; falha com o diálogo aberto | E | o cache da anterior sai; o foco e o aviso da tentativa anterior saem | |
| registrar e ver na lista | E | fim a fim | |
| cabe em 1366 × 768 | E | `paginaNaoRola` | |

## Como testar

- Tela: `apps/web/src/areas/coordenacao/material/Material.test.tsx` › "o envio com licença: o PDF sobe, o diálogo fecha…" (l.533), com o `montar(endereco)` do arquivo
- Sino: `apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts` › "os cinco tipos viram item, com o endereço certo…": vira seis
- e2e: `e2e/material.spec.ts` › "a coordenação sobe o PDF de demonstração…"; `e2e/support/coordenacao.ts` (`irPelaCoordenacao`, `linhasDaTabela`, `paginaNaoRola`)
- Relógio: `page.clock` parado para os dias do sino
- Comandos: `npx vitest run --project unidade apps/web/src/areas/coordenacao/material/Licencas.test.tsx`; `node tools/ci/e2e.ts --manter-ambiente e2e/material-licencas.spec.ts`
- Armadilha: asserção de ausência ("não avisa") só depois da resposta de `/v1/licencas` chegar
- **Telas:** `coordenacao`, `/coordenacao/material` › `text=Licenças` (vazia, com as quatro situações, diálogo de registrar); o sino aberto, com um aviso de cada texto

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 2: `grep -rln
'Licenças' e2e/`. Na 5: o "não avisa" espera a resposta. Na 10: os dias do sino com `page.clock`, num sábado também.

## Fora do escopo desta tarefa

A escolha da licença no envio (7.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
