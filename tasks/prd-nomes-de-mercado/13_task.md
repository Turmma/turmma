# Tarefa 13.0 — Onda dos documentos: o guia com a §9 reescrita, a arquitetura, a interface, os README e `.claude/`

**Funcionalidade:** nomes-de-mercado · **Depende de:** 12.0, e a correção do ouro (Arquiteto, depois da 5.0)
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os documentos vivos citam só os nomes novos: o `docs/guia-do-desenvolvedor.md` (inteiro, com a §9 reescrita só com o
que ainda é nosso e o padrão que implementa), o `docs/arquitetura.md`, o `docs/interface.md`, o README da camada de IA
e o do kit, as regras, as skills, os papéis e o `CLAUDE.md`. Fecha a X8: o `restos` dá zero com todos os mapas, sem a
isenção do ouro.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda"
- `techspec.md` §5 (o passo 5, o que fica fora e "O `restos`" na 13.0)
- `prd.md` RF9 e RF10
- `inventario.md` §4, "Documentos"
- Os mapas de `tools/renomear/mapas/` das ondas de linha (7.0 a 11.0), cujos nomes ainda estão nos documentos
- `docs/guia-do-desenvolvedor.md` §9: o que ele chama de padrão próprio, e o nome de mercado que o substitui

## Subtarefas

- [ ] 13.1 — O mapa `tools/renomear/mapas/13.json`, só com o nome de documento que não veio de uma onda (o da §9 do
  guia), ou vazio. A existência dele tira a isenção dos mapas de linha e a do ouro (1.0 e 2.0)
- [ ] 13.2 — `node tools/renomear/reaplicar.ts`, que leva aos documentos os mapas das linhas. A palavra comum da lista
  de troca à mão de cada relatório vai à mão, frase a frase
- [ ] 13.3 — A §9 do guia, reescrita só com o que ainda é nosso e o padrão que implementa
- [ ] 13.4 — O `conferir`, com o diff de código vazio. O `restos` sem isenção. O `caminhos.test.ts` da X7 verde.
  `docs/decisoes.md` e `tasks/prd-*` fechados sem diff
- [ ] 13.5 — A seção "Mutações"

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `docs/guia-do-desenvolvedor.md`, `docs/arquitetura.md`, `docs/interface.md` | alterado |
| `docs/**` | alterado |
| `packages/core/src/ia/README.md`, `apps/web/src/components/ui/ai/README.md` | alterado |
| `.claude/rules/`, `.claude/skills/`, `.claude/agents/` | alterado |
| `CLAUDE.md`, `README.md` | alterado |
| `tools/renomear/mapas/13.json`, `tools/renomear/mapas/13.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | o diff de código é vazio | |
| `restos` sem isenção | ferramenta | zero com todos os mapas: prova que a correção do ouro pousou | |
| nomes antigos no guia, na arquitetura, na interface e nos dois README | `restos` | zero (RF9) | |
| nomes antigos em `.claude/` e no `CLAUDE.md` | `restos` | zero (RF10) | |
| `caminhos.test.ts` da X7 | teste | verde (RF24 dela) | |
| `docs/decisoes.md` e `tasks/prd-*` fechados | diff | vazio | |
| §9 do guia | revisão | só a revisão garante: sem teste | |

## Como testar

- `npx vitest run --project unidade tools/processo/harness/caminhos.test.ts` e `tools/renomear/restos.test.ts`.
- A fronteira: `git diff --stat develop... -- docs/decisoes.md tasks/` mostra só `tasks/prd-nomes-de-mercado/`.
- Um documento citado por um teste de processo (`seguir.test.ts`, `caminhos.test.ts`) é conferido por esse teste: rode
  os de `tools/processo/harness/` depois do `aplicar`.
- A palavra comum vai à mão: "a fila do worker" é prosa e fica. "`Fila`" entre crases, como nome de peça, muda.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 7, nenhuma frase do guia afirma um padrão que o código não tem. Na 8, procure
o termo antigo em todos os documentos de uma vez, com `grep`.

## Fora do escopo desta tarefa

`docs/decisoes.md`, as specs fechadas, `mockups/` e o ouro, que é do Arquiteto.

## Divergências resolvidas nesta tarefa

## Mutações

**Sem mutação:** rename, sem condição nova.

## Recomendações sem aplicar
