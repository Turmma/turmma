# Tarefas — Nomes de mercado (X8)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Inventário:** `inventario.md` e anexos · **Travas:** `travas.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

## Lista

- [x] **1.0 — O `aplicar` renomeia uma onda pelo mapa, e o `reaplicar` leva o merge da `develop` ao nome novo**
  - [x] 1.1 O mapa, as seis recusas e a gravação só depois de calcular tudo
  - [x] 1.2 Os passos 1 a 5: símbolo, arquivo, pasta, pacote, comentário e documento
  - [x] 1.3 O passo 6, a lista das referências por texto, e o relatório
  - [x] 1.4 O `reaplicar`, e o passo do `/seguir` que o usa
  - [x] 1.5 Testes: os casos de `casos.md` para o `aplicar` e o `reaplicar`

- [x] **2.0 — O `conferir` prova "só nome", o `restos` prova que nada sobrou, e nenhum filtro casa vazio**
  - [ ] 2.1 O `conferir`: a foto, o mapa aplicado à foto de antes, as exceções
  - [ ] 2.2 O `restos`, com o caso sobre a árvore que as ondas citam na forma C
  - [ ] 2.3 A trava contra filtro vazio, com o mínimo de cada fonte
  - [ ] 2.4 Testes: os casos de `casos.md` para os três

- [x] **3.0 — Onda do `shared`: schemas, DTOs, erros e as pastas `erros/` e `sistema/`**
- [x] **4.0 — Onda do core, símbolos**
- [x] **5.0 — Onda do core, arquivos e pastas, e `@educa/nucleo` vira `@educa/core`**
- [x] **6.0 — Onda dos arquivos e das pastas de todos os apps e do e2e**
- [x] **7.0 — Onda da api, símbolos (linha back)**
- [x] **8.0 — Onda do worker, do despachante, do realtime e do apoio de teste do back (linha back)**
- [x] **9.0 — Onda do kit visual, símbolos (linha web)**
- [ ] **10.0 — Onda da web fora do kit (linha web)**
- [ ] **11.0 — Onda do e2e, símbolos (linha web)**
- [ ] **12.0 — A guarda `guardas/nome-de-mercado` recusa nome técnico em português em código novo**
- [ ] **13.0 — Onda dos documentos: o guia com a §9 reescrita, a arquitetura, a interface, os README e `.claude/`**

As subtarefas das ondas 3.0 a 11.0 e 13.0 estão em cada `N_task.md`. São as mesmas cinco, descritas abaixo.

## O procedimento de cada onda (3.0 a 11.0 e 13.0)

Cada onda lê as seções do anexo que o `N_task.md` aponta, e as linhas do `travas.md` com o número dela.

1. **O mapa.** Escreva o `tools/renomear/mapas/<N>.json`, com uma entrada por linha do anexo e `linhaDoAnexo` no formato `inventario-<x>.md:<linha>`. Nas ondas de linha (7.0 a 11.0), o mapa leva `"linha": true`.
2. **O rename.** Rode `node tools/renomear/aplicar.ts --mapa tools/renomear/mapas/<N>.json --escopo tasks/prd-nomes-de-mercado/<N>_task.md`. Recusa é informação, não obstáculo: corrija o mapa, nunca o `--escopo`. Se a edição tiver de sair dos "Arquivos previstos", é divergência.
3. **As travas e as ocorrências.** Troque à mão as travas da onda. Classifique cada ocorrência do relatório como `fica` ou como `trava`. A string que muda de propósito entra em `excecoesDoConferir`. A trava que o `travas.md` não lista ganha linha nele (Tech Spec §5).
4. **As provas.** Rode, nesta ordem:
   - `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/<N>.json` (a foto de antes é a do `HEAD`);
   - `node tools/renomear/restos.ts`;
   - na 4.0 e na 5.0, `npm run db:gerar`, sem migration nova e sem diff no `_journal`.

   Depois, o portão da tarefa.
5. **As mutações.** Escreva um bloco por trava, na forma que o `travas.md` dá (Tech Spec §10). A forma C cita `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados` ou o caso de `tools/guardas/filtros-casam.test.ts` da fonte. A onda sem trava leva `**Sem mutação:** rename, sem condição nova`.

O commit da onda leva o mapa, o relatório e o diff. O caso de e2e só renomeado que estoura a régua de duração fica marcado "só rename" (Tech Spec §13).

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | — |
| 2.0 | 1.0 | — |
| 3.0 | 2.0 | — |
| 4.0 | 3.0, e a correção `2026-10-29-links-do-runbook` trazida da `develop` | — |
| 5.0 | 4.0 | — |
| 6.0 | 5.0 | — |
| 7.0 | 6.0 | 9.0, 10.0 |
| 8.0 | 7.0 | 9.0, 10.0, 11.0 |
| 9.0 | 6.0 | 7.0, 8.0 |
| 10.0 | 9.0 | 7.0, 8.0 |
| 11.0 | 10.0 | 8.0 |
| 12.0 | 8.0, 11.0 | — |
| 13.0 | 12.0, e a correção do ouro (Arquiteto, depois da 5.0; `travas.md`, "O ouro") | — |

A 7.0 e a 11.0 não correm juntas: as duas editam `e2e/__fixtures__/sessao.ts` e `tools/ci/codigo-do-autenticador.test.ts`.

## Subagentes por tarefa

| Tarefa | Subagentes obrigatórios |
|---|---|
| 1.0 | `tenancy-guardian`, `test-engineer`, `revisor-geral` |
| 2.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral` |
| 3.0 a 11.0 | os quatro guardiões, `test-engineer`, `revisor-geral` (Tech Spec §11); `llm-integrator` na 4.0 e na 5.0; `frontend-reviewer` na 9.0 e na 10.0 |
| 12.0 | os quatro guardiões, `test-engineer`, `revisor-geral` |
| 13.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer`, `revisor-geral` |

Na 2.0 e na 12.0, os quatro guardiões vêm pelo caminho (`tools/guardas/`).

## Critério de pronto da funcionalidade

Vem do `ROADMAP.md` (X8) e do PRD §5:

- nenhuma peça do inventário aprovado e das adendas 1 a 4 continua com o nome antigo (RF3; o `restos` dá zero com todos os mapas, sem a isenção do ouro);
- o `@educa/core` está construído, e o compose de produção não tem diff de serviço (RF4);
- o kit visual tem os nomes do shadcn e do Radix, e o teste da onça continua sem diff (RF5);
- o apoio de teste tem os nomes de mercado, e o texto dos casos não mudou (RF6);
- o `conferir` está verde em cada onda: o mesmo número de casos por suíte, sem migration nova, e as mesmas rotas, códigos, filas, métricas e eventos (RF7);
- a guarda recusa o nome técnico em português, e a árvore passa (RF8);
- os documentos vivos, `.claude/` e o `CLAUDE.md` usam os nomes novos (RF9, RF10);
- cada trava do `travas.md` continua recusando o que recusava, com a prova da onda dela (RF11);
- a esteira está verde no último commit que alterou código.

Nenhuma tela muda, e nenhum passo do `docs/roteiro-da-demonstracao.md` é afetado.
