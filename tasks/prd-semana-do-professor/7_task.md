# Tarefa 7.0 — O painel da aula e "Preparar esta aula"

**Funcionalidade:** semana-do-professor · **Depende de:** 4.0, 6.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O painel da aula deixa a professora escrever e corrigir o que vai dar; "Preparar esta aula" leva ao Início com a turma.

## Contexto necessário

- `techspec.md` seções 7 e 9; `cenarios.md` T2, T3, T4, T7, T9; `prd.md` RF5, RF8, RF9, RF15
- `docs/interface.md` 1.8 (6.0): medidas e textos; não edite
- `apps/web/src/areas/professor/turmas/PainelDaContestacao.tsx`: o `Sheet` com texto livre, aviso e foco
- `apps/web/src/areas/professor/assistente/memoria-do-professor.ts:43` (`CONTEXTO_ESCOLHIDO`) e `CaixaDoAssistente.tsx:116`
- `apps/web/src/areas/professor/atividades/Aprovar.tsx`: o contador de `text-limits`

## Subtarefas

- [ ] 7.1 — `PainelDaAula`: o `Sheet` de `?aula=<vinculoId>.<data>.<HHMM>`, como na seção 9
- [ ] 7.2 — A mutação do `PUT`, um envio por vez; os erros da seção 9; rascunho só em memória
- [ ] 7.3 — "Preparar esta aula": a turma em `CONTEXTO_ESCOLHIDO` e o Início, sem conversa nova
- [ ] 7.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/turmas/semana/PainelDaAula.tsx`, `apps/web/src/areas/professor/turmas/semana/PainelDaAula.test.tsx` | novo |
| `apps/web/src/areas/professor/turmas/semana/Semana.tsx` | alterado |
| `apps/web/src/areas/professor/turmas/api/aulas.ts` | novo |
| `e2e/professor-semana-painel.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| T2: escrever, salvar, reabrir; o selo some; o aviso está no painel | e2e | RF5, RF6 | |
| depois de salvar, o cartão mostra o texto sem recarregar | e2e | cache | |
| "Salvar" com clique duplo manda um `PUT` (contados com `page.route`) | e2e | RF15 | |
| T3: falha, a frase e o texto guardado | e2e | erro | |
| T3: `NAO_ENCONTRADO`, a aula saiu da grade e o texto não foi salvo | e2e | erro | |
| T4: Início com a turma marcada, conversas iguais antes e depois | e2e | RF8 | |
| "Preparar" não manda o texto a requisição nenhuma | e2e | regra 20 | |
| T7: troca de escola com o painel e o rascunho, nada da anterior | e2e | RF9 | |
| T7: a saída da conta, o mesmo | e2e | recomeço, segunda pessoa | |
| T7: o rascunho nunca em `localStorage` nem `sessionStorage` | e2e | regra 50, item 7 | |
| fechar sem salvar e reabrir: o comportamento escolhido, sem o navegador | e2e | rascunho | |
| recomeço: o mesmo `?aula=` colado de novo com o painel aberto | e2e | mesma entrada | |
| recomeço: o `PUT` de A segurado, B aberta, nada de A em B | e2e | resposta atrasada | |
| recomeço: depois do erro, salvar tira a frase; reabrir não a traz | e2e | falha com o painel aberto | |
| `?aula=` reabre no recarregar; fechar o tira do endereço | e2e | endereço | |
| `?aula=` que não é aula dela não abre nem diz se existe | e2e | regra 10, item 6 | |
| rótulo "O que vou dar" até hoje, "O que foi dado" depois (S14) | unidade | RF5 | |
| contador com `aria-live="polite"`; o 501º caractere não entra | unidade | acessibilidade, limite | |
| o foco volta ao cartão com Esc e com o botão | e2e | foco | |
| lateral no `chromebook`, folha de baixo a 360 px sem rolagem (T9) | e2e (`celular`) | D51 | |
| "Salvar" e "Preparar" 44 × 44; fechar 24 × 24 | e2e (`celular`) | regra 50, 2a | |
| axe sem violação com o painel aberto | e2e | acessibilidade | |

## Como testar

- `e2e/professor-turmas.spec.ts › o complemento da contestação nunca vai ao endereço…` e `› a contestação abre num painel…`
- Resposta segurada: `e2e/acesso-da-turma.spec.ts:924`; troca de escola: `e2e/escola-e-vinculos.spec.ts:141`
- Início com a turma: `e2e/professor-inicio.spec.ts › com dado: o Assistente se apresenta e a caixa tem a turma…`
- Dados: `e2e/support/professor/semana.ts` (6.0), sem editá-lo
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professor-semana-painel.spec.ts`
- Telas: `professora`, `/professor/turmas?ver=semana&aula=<…>`, aberto e com erro

## Autoconferência

As 12 perguntas do modelo, no plano. Na 10: o clique duplo e a resposta atrasada com a ordem forçada.

## Fora do escopo desta tarefa

Grade (6.0), itens (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
