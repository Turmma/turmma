# Tarefa 4.0 — Professores mostra o envio, e o diálogo "Enviar convites"

**Funcionalidade:** acesso-e-convites · **Depende de:** 3.0
**Subagentes obrigatórios:** `frontend-reviewer`, `test-engineer`
**Porte:** pequeno

## Objetivo

Na tela Professores, cada professor mostra o estado do envio em português, o diálogo "Enviar convites" diz quantos recebem e que os links anteriores caducam, "Reenviar" e "Copiar link" avisam o mesmo, e a lista se relê sozinha enquanto há envio.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` "Telas" (linha "Professores, envio") e "E2E (RF18)"
- `prd.md` RF11, RF18 e o caso "E-mail que volta"
- `.claude/rules/50`; `docs/interface.md`, a tela Professores (perto da linha 550): a Parte A dela muda nesta tarefa
- `apps/web/src/areas/coordenacao/professores/Professores.tsx` e `convite-de-professor.ts`

## Subtarefas

- [ ] 4.1 — O rótulo de cada um dos cinco estados, com `aria-live="polite"`
- [ ] 4.2 — O diálogo "Enviar convites" (contagem, aviso, 429) e o aviso no "Reenviar" e no "Copiar link"
- [ ] 4.3 — A releitura de 5 s, só com a aba visível e linha `na_fila`/`enviando`, parando em 5 min
- [ ] 4.4 — `docs/interface.md` (Parte A de Professores) e a busca dos textos novos em `e2e/`
- [ ] 4.5 — O `docs/roteiro-da-demonstracao.md` (seção 2, passos 6 e 7) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [ ] 4.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/professores/Professores.tsx` | alterado |
| `apps/web/src/areas/coordenacao/professores/DialogoDeEnviarConvites.tsx` | novo |
| `apps/web/src/areas/coordenacao/professores/envio-do-convite.ts` | novo |
| `apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts` | novo |
| `apps/web/src/areas/coordenacao/professores/api/professores.ts` | alterado |
| `docs/interface.md` | alterado |
| `e2e/professores-envio.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| releitura com aba visível e linha em envio | unidade | a cada 5 s | |
| aba oculta, ou nenhuma linha em envio | unidade | zero leituras | |
| depois de 5 min (relógio falso) | unidade | para | |
| e-mail pelo Mailpit | e2e | o professor recebe e aceita | |
| diálogo "Enviar convites" | e2e | quantos recebem, e que os links anteriores caducam | |
| aviso do "Reenviar" | e2e | o link anterior caduca | |
| aviso do "Copiar link" | e2e | o link anterior caduca | |
| `na_fila` e `enviando` | e2e | "Enviando" | |
| `enviado` | e2e | "Enviado em 12/11 às 14:05" | |
| `falhou` | e2e | o texto de "Telas", sem culpar o professor | |
| `cancelado` | e2e | vale o estado do convite | |
| mudança de estado | e2e | `aria-live="polite"` | |
| estados: lista carregando, erro de rede, 429 | e2e | o texto e o foco depois da ação | |
| recomeço: 2ª coordenadora na mesma aba | e2e | nada da anterior | |
| recomeço: abrir o diálogo de novo | e2e | contagem atual | |
| recomeço: leitura atrasada depois de "Reenviar" (`page.route`) | e2e | não volta o rótulo velho | |
| recomeço: 429 com o diálogo aberto | e2e | o aviso sai na nova tentativa | |
| 360 px | e2e | sem rolagem horizontal; 44 px nas ações principais, 24 px no resto | |
| 1366 × 768 | e2e | cabe sem a página rolar (`paginaNaoRola`) | |

## Como testar

- Precedente: `e2e/professores.spec.ts:455` › "W14: o resumo antes de enviar, o link uma vez com "Link copiado"…" e o describe "W12 (Professores): a 360 px e só com teclado"
- Apoio: `paginaNaoRola` (`e2e/support/coordenacao.ts:97`), `horizontalOverflow`, `ALVO_DE_TOQUE_PRINCIPAL_PX` e `seriousViolations` (`e2e/support/checks.ts`), `criarEquipeComSenha` (`e2e/support/seed.ts:87`)
- O e-mail chega ao Mailpit (1.0): leia a API dele no e2e; não há precedente no repositório
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professores-envio.spec.ts`; `npx vitest run --project unidade apps/web/src/areas/coordenacao/professores/`
- Telas: `coordenacao`, `/professores` (`apps/web/src/paths.ts:83`); o diálogo por "Enviar convites"

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Enviando" e "Reenviar" já aparecem em `e2e/`? Rode os specs que os contam.

## Fora do escopo desta tarefa

A API (3.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
