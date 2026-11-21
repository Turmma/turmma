# Tarefa 7.0 — A Operação define o orçamento de IA num diálogo, vendo o antes e o depois

**Funcionalidade:** camada-ia · **Depende de:** 3.0
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Na aba Escolas da Operação, a rede e a escola ganham a ação "Orçamento de IA". O diálogo mostra o que vale hoje e, antes
de "Salvar orçamento", o antes e o depois; na rede, quantas escolas mudam. É o diálogo que a 8.0 abre de "Definir orçamento".

## Contexto necessário

- `techspec.md` §4 (os dois `PUT` e as `GET` estendidas), §9 ("Operação, Escolas")
- `prd.md` RF7
- `cenarios.md` §4 ("Operação, diálogo 'Orçamento de IA'", erro, celular e acessibilidade)
- `.claude/rules/50-frontend.md`, `docs/interface.md` §5a
- Código: `apps/web/src/operacao/pages/Escolas.tsx` (`useDialogState`, as ações por linha), `apps/web/src/operacao/components/DialogoDoConvite.tsx`
  e `DialogoDaOperacao.tsx`, `apps/web/src/operacao/api/painel.ts`, `apps/web/src/operacao/pedidos-do-painel.ts` (o 429)

## Subtarefas

- [ ] 7.1 — `apps/web/src/operacao/components/DialogoDoOrcamento.tsx`: os dois campos, "Usar o valor da rede", "Vale hoje",
  a confirmação com antes e depois e, na rede, "Muda o orçamento de N escolas…"
- [ ] 7.2 — A ação na linha da rede e na da escola (tabela e cartão do celular); a mutação invalida as listas de redes, escolas e uso
- [ ] 7.3 — Os erros: fora do intervalo no campo, `role=alert` e `aria-describedby`; o 429 com os minutos
- [ ] 7.4 — `docs/interface.md` §5a (Escolas), com os textos da `cenarios.md` §4
- [ ] 7.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/operacao/components/DialogoDoOrcamento.tsx`, `apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx` | novo |
| `apps/web/src/operacao/pages/Escolas.tsx`, `apps/web/src/operacao/pages/Escolas.test.tsx` | alterado |
| `apps/web/src/operacao/api/painel.ts`, `apps/web/src/operacao/api/painel.test.ts`, `apps/web/src/operacao/textos.ts` | alterado |
| `e2e/operacao-escolas.spec.ts` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| cada campo com o seu rótulo: "Valor por aluno por mês (R$)", "Teto de segurança (% do orçamento)", "Usar o valor da rede" | U | rótulo por campo | |
| "Vale hoje: R$ 5,00 por aluno, da rede." | U | o vigente | |
| antes de salvar: "Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%." | U | a confirmação do efeito | |
| na rede: "Muda o orçamento de 3 escolas que usam o valor da rede." | U | `escolasQueUsamOValorDaRede` | |
| "Usar o valor da rede" manda `null` | U | a volta à rede | |
| R$ 0,00, R$ 100,01, 99% e 1001%: "Use um valor entre R$ 0,01 e R$ 100,00." / "Use de 100% a 1000%.", com `aria-describedby` e `role=alert`, sem chamar a API; R$ 0,01, R$ 100,00, 100 e 1000 passam | U | os limites e o anúncio | |
| "Orçamento salvo."; invalida redes, escolas e uso | U | o resultado e o cache | |
| dois cliques em "Salvar orçamento": um `PUT` só | U | o clique duplo | |
| o 429 diz em quantos minutos tentar de novo | U | o limitador | |
| carregando; erro "Não foi possível carregar. Tentar de novo"; resposta fora do contrato: "Atualize a página" | U | os estados e a volta do código | |
| só com Tab e Enter: abre, preenche, confirma; `Esc` fecha; o foco fica preso no diálogo e volta a quem abriu | E2E | acessibilidade | |
| a 360 px, sem rolagem horizontal; "Salvar orçamento" com 44 px; alvo de 24 px nos campos e na caixa; nada só por hover | E2E | celular | |

## Como testar

- Diálogo com foco preso: `e2e/operacao-escolas.spec.ts` › "W8: criar rede e escola só com Tab e Enter, com o foco preso
  no diálogo e devolvido a quem o abriu"
- Estados: `apps/web/src/operacao/pages/Escolas.test.tsx` › "o 503 mostra a mensagem e a tela fica…" e › "no celular, a
  lista de cartões diz o mesmo texto e oferece as mesmas ações, sem tabela"
- Montagem: `apps/web/src/operacao/__fixtures__/render-operacao-screen.tsx`
- `npx vitest run --project unidade apps/web/src/operacao/` e `npx playwright test e2e/operacao-escolas.spec.ts`
- **Telas:** papel operador (o perfil Operação do roteiro), `/operacao` (`OPERACAO_ROUTES.inicio`, Escolas): clicar em
  "Orçamento de IA" numa rede e numa escola, até a confirmação; sem mockup

## Fora do escopo desta tarefa

A aba Uso (8.0); a API (3.0).

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
| `frontend-reviewer`, rodada 2 | "Teto de segurança" é jargão para o operador | 7.1: uma frase de ajuda abaixo do campo, fixada em `docs/interface.md` |
