# Tarefa 6.0 — As telas "Esqueci a senha" e "Redefinir"

**Funcionalidade:** acesso-e-convites · **Depende de:** 5.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

A equipe pede o link pela entrada, recebe o e-mail e define a senha nova; volta à entrada com "Senha trocada. Entre com a nova", sem login automático. As duas telas são formulários de um campo do mesmo link.

## Contexto necessário

- `techspec.md` seções 4 e 9; `cenarios.md` "Telas" (Esqueci, Redefinir) e "E2E (RF18)"
- `prd.md` RF12, RF18
- `.claude/rules/50`
- `apps/web/src/pages/Entrar.tsx` (o link novo), `apps/web/src/pages/url-fragment.ts` (o token no `#`), `apps/web/src/paths.ts`

## Subtarefas

- [ ] 6.1 — A tela "Esqueci a senha" e o link na entrada da equipe
- [ ] 6.2 — A tela "Redefinir", que lê o token do fragmento e o tira da barra
- [ ] 6.3 — `docs/interface.md`: as duas telas e a entrada
- [ ] 6.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/EsqueciASenha.tsx` | novo |
| `apps/web/src/pages/RedefinirSenha.tsx` | novo |
| `apps/web/src/pages/Entrar.tsx` | alterado |
| `apps/web/src/paths.ts` | alterado |
| `apps/web/src/routes.tsx` | alterado |
| `apps/web/src/api/senha.ts` | novo |
| `docs/interface.md` | alterado |
| `e2e/esqueci-a-senha.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| esqueci → redefinir pelo Mailpit | e2e | volta à entrada com o aviso, sem login automático | |
| link na entrada da equipe | e2e | leva ao "Esqueci" | |
| "Esqueci" inicial | e2e | campo de e-mail e "Aluno: peça a senha provisória ao professor" | |
| "Esqueci" enviado | e2e | a mesma frase para todos | |
| estados: botão ocupado e rede com "Tentar de novo" | e2e | o texto de "Telas", nas duas | |
| "Redefinir" inicial | e2e | regra visível, "mostrar senha", `autocomplete="new-password"` | |
| link vencido, usado ou inválido | e2e | "Este link não vale mais…" | |
| senha recusada | e2e | mostra a regra | |
| recomeço: 2ª pessoa | e2e | não se aplica: tela anônima, sem sessão | |
| recomeço: o mesmo link colado de novo | e2e | estado refeito, token fora da barra | |
| recomeço: resposta atrasada (`page.route`) | e2e | não sobrescreve | |
| recomeço: falha de rede | e2e | aviso e foco saem na nova tentativa | |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | |

## Como testar

- Precedente: `e2e/entrar-na-escola.spec.ts` › "caminho feliz só com teclado: o aluno vê o nome da escola, digita matrícula e senha e entra, com foco visível"; o token no `#`: como o `Convite.tsx`
- Apoio: `criarEquipeComSenha` (`e2e/support/seed.ts:87`), `horizontalOverflow` e `seriousViolations` (`e2e/support/checks.ts`); o e-mail pela API do Mailpit
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/esqueci-a-senha.spec.ts`
- Telas: anônimo, `/entrar` › "Esqueci a senha"; o "Redefinir" pelo link do e-mail

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Tentar de novo" e "Esqueci" já aparecem em `e2e/`?

## Fora do escopo desta tarefa

A API (5.0); o "Verificar" (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
