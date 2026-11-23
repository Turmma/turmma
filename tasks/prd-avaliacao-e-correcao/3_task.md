# Tarefa 3.0 — O aluno começa e responde dentro do limite

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O aluno começa só dentro da janela, a tentativa nasce no `comecar`, e resposta além do limite é recusada sem gravar.

## Contexto necessário

- `techspec.md` §4 (`comecar`, `prova`, `tempo`, PUT, `minhas-atividades`), §5.2 a §5.5, §6, §7
- `prd.md` RF1, RF5, RF6, RF7 (a API)
- `cenarios.md` §1 (RF1, RF5, RF6, RF7 da API), §1b (aluno), §3 (a) e (b)
- `apps/api/src/atividade/minha-atividade/`: hoje o `prova` cria a tentativa (U05-15)

## Subtarefas

- [ ] 3.1 — Alcance, janela e limite, nessa ordem (§5.2)
- [ ] 3.2 — `comecar`, `prova` sem gravar e `tempo` (§4, §5.3)
- [ ] 3.3 — PUT e envio no limite (§5.5); `minhas-atividades`; a guarda de pulso nas rotas novas
- [ ] 3.4 — `Atividade.tsx` de hoje chama `comecar` antes de `prova`
- [ ] 3.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts` | alterado |
| `apps/api/src/atividade/atividade.int.test.ts` | alterado |
| `apps/api/src/atividade/atividade-isolamento.int.test.ts` | alterado |
| `apps/api/src/atividade/prova-online-aluno.int.test.ts` | novo |
| `apps/web/src/areas/aluno/atividade.ts` | alterado |
| `apps/web/src/areas/aluno/Atividade.tsx` | alterado |
| `apps/web/src/areas/aluno/Atividade.test.tsx` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Começar antes de `abre_em` e depois de `fecha_em` | integração | `PROVA_FORA_DA_JANELA`, sem tentativa | dentro da janela começa | |
| Começo a 10 min do `fecha_em` com duração 40 | integração | `limiteEm` = `fecha_em` | começo cedo dá 40 | |
| `prova` sem tentativa | integração | sem questões, sem gravar | depois do `comecar`, com questões | |
| `duracaoMin` do aluno com +50% | integração | 60 em `prova` e `minhas-atividades`, sem "adicional" nem percentual | o colega lê 40 | |
| PUT e envio depois do limite; vencida sem envio | integração | `TEMPO_ESGOTADO` sem linha; leitura com `envio = 'limite'` | um minuto antes grava; a do aluno diz `aluno`; a não avaliativa grava a qualquer hora | |
| Pulso parado, relógio +31 s | integração | 503 em `comecar` e `tempo`; `minhas-atividades` segue | +29 s aceita | |
| Corrida (b) PATCH × começar | integração | o `comecar` espera o PATCH segurado e grava o limite da janela nova | sem `for share`, o da antiga | |
| PUT com indisponibilidade fechada de 5 min | integração | grava 2 min depois do limite original; `prova` e `tempo` trazem `limiteEm` + 5 | sem indisponibilidade, recusa | |
| Lacuna aberta montada à mão | integração | PUT, `prova` e `tempo` contam os 3 min | limite original = `fecha_em`, já passado | |
| Corrida (a) começar × começar | integração | uma tentativa, um `limite_base_em` | a primeira segurada; a segunda, com outro `now()`, devolve o `limiteEm` da primeira | |
| Escola sem ano em curso; repository do alcance com escola ou ano errado no contexto | integração | `NAO_ENCONTRADO`; `minhas-atividades` vazia; o repository devolve vazio | com ano em curso, aparece | |
| Aluno transferido com tentativa em A | integração | em A, as rotas `NAO_ENCONTRADO`; a tentativa fica; `minhas-atividades` só com as de B | o vínculo aberto em B | |
| Aluno de outra turma e de outra escola, fora da janela | integração | `NAO_ENCONTRADO`, nunca `PROVA_FORA_DA_JANELA` | o da turma recebe `PROVA_FORA_DA_JANELA` | |
| 31ª chamada de `comecar` no minuto | integração | 429; outro aluno no mesmo IP passa | a 30ª passa | |
| Contrato do aluno | unidade | só o `limiteEm` dele; sem `saidas` nem `tempoAdicional` | | |
| Tela de hoje | unidade web | `comecar` antes de `prova` | a ordem das chamadas | |

## Como testar

- Responder: `apps/api/src/atividade/atividade.int.test.ts › a resposta é gravada de forma idempotente…`, com
  `responderProva` (`apps/api/test/atividade.fixture.ts`)
- Isolamento: `atividade-isolamento.int.test.ts › o aluno de outra turma e o de outra escola não listam…`
- Janela e pulso envelhecidos direto no banco
- Contrato do aluno: o mecanismo de `apps/api/test/contracts.test.ts` (perto da linha 319)
- `npx vitest run --project integracao apps/api/src/atividade/prova-online-aluno.int.test.ts`
- Armadilha: `e2e/aluno-atividade.spec.ts` segue verde com a 3.4; rode-o isolado

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`). A 4: o cenário da janela usa um aluno no alcance.

## Fora do escopo desta tarefa

Embaralhamento (4.0); extensões (5.0); saídas (8.0); a tela de foco (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
