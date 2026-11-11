# Tarefa 9.0 — Toda leitura de página filtra por série e licença vigente; sem material, ninguém gera

**Funcionalidade:** ingestao-do-material · **Depende de:** 8.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Toda leitura de página só alcança material `pronto` da série da turma, próprio ou de licença vigente hoje; sem nenhum,
ferramenta e chat recusam antes do `202`, e o Tutor depois da D36, com um estado na tela do aluno.

## Contexto necessário

- `techspec.md` §5 "Leitura de página", §6, §7b, §7c, §9 (Tutor do aluno), §11 (RF8)
- `prd.md` RF7, RF8, RF15, RF17
- `cenarios.md` "Leitura de página por série", "Licença", "Telas", "Carga"
- `.claude/rules/` 10, 30, 40, 70 (itens 3 e 4), 80
- Código: `apps/api/src/material/trecho-search.ts` (`buscar`, l.55); `apps/api/src/material/material.repository.ts`
  (`paginasDoMaterial`, l.286); `apps/api/src/tutor/tutor.service.ts` (l.251, e a conferência depois do `202`, l.206);
  `apps/api/src/tutor/tutor.repository.ts` (`materialDaTurma`, l.189); `apps/web/src/areas/aluno/tutor.ts` (`pausaDoErro`, l.86)

## Subtarefas

- [ ] 9.1 — Série e "hoje" (`Clock`, São Paulo) em `buscar`, `paginasDoMaterial`, `materialDaTurma` e `GET /v1/materiais/busca` (`serieId` filtra, não autoriza); `existeMaterialDaSerie` igual
- [ ] 9.2 — `SEM_MATERIAL_DA_SERIE` na ferramenta e no chat antes do `202`, sem execução nem orçamento
- [ ] 9.3 — Tutor: a D36 intacta (`materialId` nulo) e só depois o filtro e a série; a conferência depois do `202` com o mesmo filtro (R6); página fora do alcance com o código do `enviar` (R6); recusas por turma, sem aluno (R6)
- [ ] 9.4 — O estado do aluno do `cenarios.md`, pelo `pausaDoErro`
- [ ] 9.5 — Carga: `npm run carga:ingestao` e `:controle-negativo`, com a corrida registrada
- [ ] 9.6 — `docs/interface.md`, `docs/runbook.md`; testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/material/trecho-search.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/tutor/tutor.service.ts`, `apps/api/src/tutor/tutor.repository.ts`, `apps/api/src/artefato/ferramentas.service.ts`, `apps/api/src/assistente/assistente.service.ts`, `packages/shared/src/material/material.ts`, `apps/web/src/areas/aluno/tutor.ts`, `apps/web/src/areas/aluno/tutor.test.ts`, `apps/web/src/areas/aluno/Tutor.tsx`, `e2e/aluno-tutor.spec.ts`, `apps/api/src/tutor/tutor.int.test.ts`, `package.json`, `docs/interface.md`, `docs/runbook.md` | alterado |
| `infra/scripts/carga-ingestao.ts`, `infra/scripts/conferir-carga-ingestao.ts`, `apps/api/test/leitura-por-serie.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| só do 6º, turma do 9º, por chamador | I | nada citado: atividade, plano, adaptação, chat, turno, página aberta, `materialDaTurma`, `GET /busca` | |
| 23h do último dia; 0h01 do seguinte | I | volta; não volta | |
| licença futura | I | fora até o dia | |
| `PATCH` que estende | I | volta, também na página aberta | |
| único vencido ou `processando` | I | `SEM_MATERIAL_DA_SERIE`, sem chamar o adaptador, sem execução nem consumo | |
| D36: sem material; edição substituída; licença vencida | I | mensagem fixa e `atencao_humana`. Mutação: filtro antes da D36 | |
| os três com pergunta comum | I | recusada, nada em `mensagem_tutor`, no uso nem na sala | |
| [P] material sai entre o `202` e a conferência | P | recusado (R6) | |
| página fora do alcance | I | o código do `enviar` (R6) | |
| recusas por turma | I | contadas sem aluno (R6) | |
| modo livre | I | aceito | |
| virada do ano | I | o 9º de 2027 acha o do 9º; o que passou do 8º só acha o do 9º | |
| `serieId` de outra turma | I | não abre material | |
| isolamento | I | busca e página aberta da A com série da B: vazias | |
| estado do aluno | U | texto, sem avatar | |
| estado do aluno | E | a tela; `paginaNaoRola` | |
| [C] carga | C | abaixo | |

Critérios da [C]: 300 PDFs do maior tamanho pela rota real, com o guard, por três coordenadores, com a B no Tutor no pico;
as 300 projetadas entre 19h e 5h com uma réplica; p95 do turno da B até 500 ms acima da base; nenhum statement acima de
1,5 s; o PDF da B espera até duas extrações; `VAGAS_POR_ESCOLA_DESLIGADAS` reprova. O "Caso" leva a corrida
(`docs/runbook.md`, "Quando a carga vale como registro").

## Como testar

- Chamador: `apps/api/test/material.int.test.ts` › "`BuscaDeTrechos`, a porta do Assistente e do Tutor…" (l.421)
- D36: `apps/api/src/tutor/tutor.int.test.ts` › "recebe a mensagem fixa na hora…"
- Sem modelo: `apps/api/src/assistente/assistente.int.test.ts` › "suspensão por função (D60)", com o `FakeAdapter`
- Relógio: `RelogioDeslocavel` (`apps/api/test/convites-enviar.int.test.ts:44`)
- Aluno: `apps/web/src/areas/aluno/tutor.test.ts` › "a recusa do servidor (409 ou 429) vira o aviso…"
- Carga: `infra/scripts/carga-importacao.ts`
- Comando: `npx vitest run --project integracao apps/api/test/leitura-por-serie.int.test.ts`
- **Telas:** `aluno`, `/aluno` › a atividade da turma sem material (o estado)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada termo do
filtro, nas quatro cópias.

## Fora do escopo desta tarefa

Habilidade BNCC na busca (F4b).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
