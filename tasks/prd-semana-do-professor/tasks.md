# Tarefas — Semana do professor

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

## Lista

- [x] **1.0 — O registro da aula existe, só a professora o alcança, e sai na virada do ano**
  - [ ] 1.1 Tabela `aula` e migration só de criação, com a FK composta para o vínculo e os checks
  - [ ] 1.2 Matriz `aula: ['ler', 'gravar']`, classificação e arquivo do titular só na versão `completa`
  - [ ] 1.3 `virarAno` apaga as linhas de `aula` do ano; comentário da troca de nome
  - [ ] 1.4 `docs/lgpd.md` e `docs/modelo-de-dados.md`
  - [ ] 1.5 Testes: checks, FK e cascata; R5, R6; o `virarAno` do S7 e o isolamento dele

- [x] **2.0 — A professora vê a semana dela (`GET /v1/semana`)**
  - [ ] 2.1 Contrato das duas rotas em `packages/shared`, com o limite de 500 e os rótulos dos itens
  - [ ] 2.2 `SemanaRepository` (vínculos, alocações, eventos, registros) e a montagem dos dias
  - [ ] 2.3 Controller, service e módulo; `itens` vazio até a 3.0
  - [ ] 2.4 Testes: S1 a S8, S11 a S16 do lado do servidor, G7, R2, R3, R4 e R7 da leitura

- [x] **3.0 — Os itens do dia entram na semana (RF7)**
  - [ ] 3.1 A consulta dos itens pela (turma, disciplina) dos vínculos, no fuso da escola, com `EXPLAIN`
  - [ ] 3.2 Testes: S9, S10, R2 dos itens, a consulta com os índices

- [ ] **4.0 — A professora grava o que vai dar (`PUT /v1/aulas`)**
  - [ ] 4.1 `AulaRepository.gravar`: ano `for share`, conferência, trava consultiva do vínculo, upsert, `lock_timeout`
  - [ ] 4.2 Controller e service da rota
  - [ ] 4.3 Testes: G1 a G6, R1, R1b, R4, R7 e S16 da gravação, S6, J13, J14

- [ ] **5.0 — O texto acompanha a reimportação da grade e do calendário**
  - [ ] 5.1 O passo entre `gravarAulas` e `encerrarOsMarcados`: travas, pareamento, re-chaveamento, apagar o futuro
  - [ ] 5.2 Testes: J1 a J16

- [ ] **6.0 — Turmas ganha a aba Semana**
  - [ ] 6.1 As abas "Turmas · Semana" e a leitura sob demanda
  - [ ] 6.2 A semana: dias, cartões, navegação, filtro, estados, celular
  - [ ] 6.3 `docs/interface.md` 1.8 inteira e o roteiro da demonstração conferido
  - [ ] 6.4 Testes: T1, T8, T9, T10, T11, o selo do S14, o recomeço

- [ ] **7.0 — O painel da aula e "Preparar esta aula"**
  - [ ] 7.1 O `Sheet` com o texto, o contador, o aviso e as duas ações
  - [ ] 7.2 Testes: T2, T3, T4, T7, o painel no celular, o recomeço

- [ ] **8.0 — Os itens do dia na Semana e "Ver a semana desta turma"**
  - [ ] 8.1 Os itens com os rótulos de `packages/shared` e os links
  - [ ] 8.2 O link no Hoje da turma aberta
  - [ ] 8.3 Testes: T5, T6, o vocabulário

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | — |
| 2.0 | 1.0 | — |
| 3.0 | 2.0 | 4.0, 5.0, 6.0, 7.0 |
| 4.0 | 2.0 | 3.0, 6.0, 8.0 |
| 5.0 | 4.0 | 3.0, 6.0, 7.0, 8.0 |
| 6.0 | 2.0 | 3.0, 4.0, 5.0 |
| 7.0 | 4.0, 6.0 | 3.0, 5.0, 8.0 |
| 8.0 | 3.0, 6.0 | 4.0, 5.0, 7.0 |

O tronco (tabela, matriz, contrato em `packages/shared`, módulo da API) fica na 1.0 e na 2.0. A 3.0 e a 4.0 não tocam o mesmo
arquivo: a 3.0 fica no `semana.repository.ts` e na montagem, a 4.0 no `aula.repository.ts`, no barril do `core/semana` e no
módulo. A 5.0 importa o `AulaRepository` pelo caminho, sem mexer no barril. A `docs/interface.md` 1.8 é escrita inteira na
6.0, e a 7.0 e a 8.0 não a editam; o apoio de e2e (`e2e/support/professor/semana.ts`) também é só da 6.0.

## Subagentes por tarefa

| Tarefa | Subagentes obrigatórios |
|---|---|
| 1.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer` |
| 2.0 | `tenancy-guardian`, `privacy-guardian`, `test-engineer` |
| 3.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer` |
| 4.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` |
| 5.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` |
| 6.0 | `frontend-reviewer`, `privacy-guardian`, `test-engineer` |
| 7.0 | `frontend-reviewer`, `privacy-guardian`, `test-engineer` |
| 8.0 | `frontend-reviewer`, `conformidade-reviewer`, `test-engineer` |

## Critério de pronto da funcionalidade

Do `ROADMAP.md` (F2b): a professora vê a semana dela na escola ativa, derivada da grade e do calendário que a coordenação
importou, e escreve o que vai dar em cada aula. Em detalhe:

- os 15 RFs do PRD com a prova da coluna "Como se prova", e cada id do `cenarios.md` com o caso numa tarefa
- nenhuma rota da coordenação, da rede ou do aluno devolve o texto, nem contagem de aula preenchida; o arquivo do titular da
  versão `coordenacao` não traz a `aula`
- reimportar a grade e o calendário não apaga texto passado
- a Semana cabe a 1366 × 768 sem a página rolar e funciona a 360 px, nos projetos `chromebook` e `celular`
- `docs/lgpd.md`, `docs/modelo-de-dados.md` e `docs/interface.md` 1.8 descrevem o que foi feito; o roteiro da demonstração
  conferido contra `e2e/roteiro-da-demonstracao.spec.ts` na 6.0, porque Turmas ganha abas
