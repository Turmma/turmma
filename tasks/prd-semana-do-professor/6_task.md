# Tarefa 6.0 — Turmas ganha a aba Semana

**Funcionalidade:** semana-do-professor · **Depende de:** 2.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

Em Turmas, a aba **Semana** mostra as aulas da professora na escola ativa, semana a semana, e um dia por vez no celular.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` T1, T8 a T11, S14; `prd.md` RF1 a RF4, RF6, RF9, RF12
- `.claude/rules/50`; `docs/interface.md` 1.7 e 6
- `apps/web/src/components/ui/Tabs.tsx`; `Turma.tsx`: a aba no endereço com `replace` e a altura pelo `miolo-do-documento.ts`
- `docs/roteiro-da-demonstracao.md`: os passos que passam por **Turmas**

## Subtarefas

- [ ] 6.1 — `Tabs` "Turmas · Semana" com `?ver=semana` (`replace`); a semana só é lida com a aba aberta
- [ ] 6.2 — A semana da seção 9; o clique no cartão põe `?aula=` (o painel é da 7.0)
- [ ] 6.3 — Os estados e os vazios do RF12
- [ ] 6.4 — `docs/interface.md` 1.8 inteira, painel e itens incluídos; o roteiro conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [ ] 6.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/turmas/Turmas.tsx`, `apps/web/src/areas/professor/turmas/Turmas.test.tsx` | alterado |
| `apps/web/src/areas/professor/turmas/semana/Semana.tsx`, `apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx`, `apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx` | novo |
| `apps/web/src/areas/professor/turmas/semana/semana.ts`, `apps/web/src/areas/professor/turmas/semana/semana.test.ts` | novo |
| `apps/web/src/areas/professor/turmas/api/semana.ts` | novo |
| `e2e/professor-semana.spec.ts`, `e2e/support/professor/semana.ts` | novo |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| T1 | e2e | aulas de três turmas; navegação e endereço | |
| a aba Turmas não chama `GET /v1/semana` | e2e | sob demanda | |
| `?ver=semana` com `replace` | e2e | histórico | |
| `?semana=` abre a semana; inválido ou fora do ano, a de hoje | e2e | endereço | |
| `?turma=` só aquela turma e disciplina; a que não é dela, vazio | e2e | filtro | |
| o endereço leva só ids e datas | e2e | regra 50, item 7 | |
| anterior desabilitada em `ano.inicio`, seguinte em `ano.fim` | e2e | presa ao ano | |
| cartão com nome acessível "Terça, 7h30, 7ºA, Matemática" | e2e | acessibilidade | |
| texto do cartão em duas linhas | e2e | line-clamp | |
| S14 e T11: "Falta preencher" por aula, token neutro, sem total | unidade e e2e | D59, D64 | |
| fora da grade, com marca | e2e | RF14 | |
| feriado e recesso com tipo e descrição; evento junto das aulas | e2e | RF3 | |
| fim de semana só com aula | e2e | RF1 | |
| T8, com o vazio e o aviso só depois da leitura | e2e | quatro estados | |
| depois de "Tentar de novo", o foco tem lugar | e2e | foco | |
| T9: um dia por vez, dia inicial, 360 px sem rolagem | e2e (`celular`) | D51 | |
| alvos de 24 × 24, e 44 × 44 na ação principal | e2e (`celular`) | regra 50, 2a | |
| T10: 40 aulas no `chromebook`; `soOPainelDaAbaRola` e `paginaNaoRola` a 1366 × 768 | e2e | RF22 | |
| axe sem violação com dado e no vazio | e2e | acessibilidade | |
| recomeço: segunda professora na mesma aba | e2e | P30 | |
| recomeço: o mesmo endereço colado de novo | e2e | mesma entrada | |
| recomeço: semana A segurada (`page.route`), B não é substituída | e2e | `queryKey` | |
| recomeço: falha seguida de sucesso não deixa erro nem foco preso | e2e | falha | |
| RF9: troca de escola, nada da primeira | e2e | P30 | |

## Como testar

- 360 px, toque, axe: `e2e/professor-turmas.spec.ts › a contestação abre num painel…` (`horizontalOverflow`, `seriousViolations`)
- Aba no endereço: `e2e/professor-turma-aberta.spec.ts › trocar de aba guarda a aba no endereço e não empilha histórico…`
- Altura: `e2e/professor-turma-aberta.spec.ts › Hoje mantém a página parada a 1366 × 768…`
- Troca de escola: `e2e/escola-e-vinculos.spec.ts › isolamento: trocar de escola pelo seletor não leva a turma da escola anterior…`
- Resposta segurada: `e2e/acesso-da-turma.spec.ts:924`
- Dados: `criarAlocacaoDoProfessor`, `confirmarVinculosNoBanco`, `criarEventoDoCalendarioNoBanco` (`e2e/support/seed.ts`), em `e2e/support/professor/semana.ts`; relógio com `page.clock`
- Entrada: `entrarPelaApiSemMedirAPrimeiraCarga` (`e2e/support/casca.ts:233`)
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professor-semana.spec.ts`
- Telas: `professora`, `/professor/turmas?ver=semana`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: "Turmas" e "Semana" já aparecem em `e2e/` (`grep -rln`).

## Fora do escopo desta tarefa

Painel (7.0), itens e link do Hoje (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
