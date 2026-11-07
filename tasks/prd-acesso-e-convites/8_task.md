# Tarefa 8.0 — A tela "Verificar" e o aviso de `VERIFICACAO_PENDENTE` no aceite

**Funcionalidade:** acesso-e-convites · **Depende de:** 7.0
**Subagentes obrigatórios:** `frontend-reviewer`, `test-engineer`
**Porte:** pequeno

## Objetivo

Quem aceita um convite copiado de outra escola lê no aceite que o link foi ao e-mail; o link abre "Verificar", que confirma e leva de volta ao convite.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` "Telas" (Verificar, Aceite com `VERIFICACAO_PENDENTE`)
- `prd.md` RF12, RF18
- `apps/web/src/pages/Convite.tsx` (o aceite) e `apps/web/src/pages/url-fragment.ts`

## Subtarefas

- [ ] 8.1 — A tela "Verificar"
- [ ] 8.2 — O aviso no aceite
- [ ] 8.3 — `docs/interface.md`
- [ ] 8.4 — O `docs/roteiro-da-demonstracao.md` (seção 2, passo 8) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [ ] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/VerificarEmail.tsx` | novo |
| `apps/web/src/pages/Convite.tsx` | alterado |
| `apps/web/src/paths.ts` | alterado |
| `apps/web/src/routes.tsx` | alterado |
| `docs/interface.md` | alterado |
| `e2e/verificar-email.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| verificar pelo Mailpit | e2e | "E-mail confirmado" e "Continuar" leva ao convite | |
| carregando | e2e | "Confirmando…" | |
| link vencido ou usado | e2e | "Peça outro link abrindo o convite de novo" | |
| aceite com `VERIFICACAO_PENDENTE` | e2e | o texto de "Telas" | |
| recomeço: 2ª pessoa | e2e | não se aplica: anônima | |
| recomeço: o mesmo link de novo | e2e | token fora da barra, sem ficar preso | |
| recomeço: resposta atrasada | e2e | não troca o estado | |
| recomeço: erro | e2e | o aviso sai na nova tentativa | |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | |

## Como testar

- Precedente: `e2e/professores.spec.ts:455` (W14, o aceite pelo link); `criarUsuarioEmOutraEscola` e `criarConviteDeProfessor` (`e2e/support/seed.ts:115`, `:704`)
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/verificar-email.spec.ts`
- Telas: anônimo, `/convite` (aceite) e o link do e-mail

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: o texto do aviso já existe em `e2e/`?

## Fora do escopo desta tarefa

A API (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
